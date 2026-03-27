import { useDeferredValue, useEffect, useState } from "react";
import ProductForm from "../components/ProductForm";
import ProductList from "../components/ProductList";
import {
  MAX_IMAGES_PER_MODE,
  ONE_SIZE_LABEL,
  buildFormFromProduct,
  formatProductActionError,
  buildProductPayload,
  createEmptyVariationRow,
  createEmptyProductForm,
  createLocalImageEntry,
  deleteUploadedImages,
  generateNextProductId,
  getCatalogColorOptions,
  getCatalogSizeOptions,
  getDerivedVariationAvailability,
  isLocalImageEntry,
  isMissingImageUploadEndpointError,
  normalizeCurrencyCodeInput,
  normalizeProductIdInput,
  productMatchesSearch,
  revokeLocalImageEntry,
  removeProduct,
  saveProduct,
  uploadProductImage
} from "../lib/admin";

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

function getVariationTotal(variations, sizeMode) {
  return String(
    (Array.isArray(variations) ? variations : []).reduce(
      (sum, variation) =>
        String(variation?.color || "").trim() &&
        (sizeMode === "one-size" || String(variation?.size || "").trim())
          ? sum + Math.max(0, Number(variation?.quantity || 0))
          : sum,
      0
    )
  );
}

function syncVariationRows(variations, formState) {
  const sizeMode = formState.size_mode === "varied" ? "varied" : "one-size";
  const colorOptions = getCatalogColorOptions(formState.colors);
  const sizeOptions = getCatalogSizeOptions(formState.sizes, sizeMode);

  return (Array.isArray(variations) ? variations : []).map((variation) => {
    const rawColor = String(variation?.color || "").trim().toLowerCase();
    const rawSize = String(variation?.size || "").trim().toLowerCase();
    const matchedColor =
      colorOptions.find((option) => option.toLowerCase() === rawColor) || "";
    const matchedSize = sizeMode === "one-size"
      ? ONE_SIZE_LABEL
      : sizeOptions.find((option) => option.toLowerCase() === rawSize) || "";
    const quantity = String(variation?.quantity ?? "0");

    return {
      ...variation,
      availability_status: getDerivedVariationAvailability(quantity),
      color: matchedColor,
      quantity,
      size: matchedSize
    };
  });
}

function revokeFormPreviewUrls(form) {
  (form?.light_images || []).forEach(revokeLocalImageEntry);
  (form?.dark_images || []).forEach(revokeLocalImageEntry);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to process the selected image."));
    image.src = src;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Unable to compress the selected image."));
    }, type, quality);
  });
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to encode the selected image."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

async function compressFileForInlineFallback(file) {
  if (String(file?.type || "").toLowerCase() === "image/svg+xml") {
    return readFileAsDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    let width = image.naturalWidth || image.width || 1;
    let height = image.naturalHeight || image.height || 1;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return readFileAsDataUrl(file);
    }

    const maxDimension = 720;
    const initialScale = Math.min(1, maxDimension / Math.max(width, height));
    width = Math.max(1, Math.round(width * initialScale));
    height = Math.max(1, Math.round(height * initialScale));

    const targetBytes = 24 * 1024;
    let quality = 0.82;
    let blob = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      blob = await canvasToBlob(canvas, "image/webp", quality);

      if (blob.size <= targetBytes) {
        break;
      }

      if (quality > 0.46) {
        quality -= 0.08;
      } else {
        width = Math.max(320, Math.round(width * 0.85));
        height = Math.max(320, Math.round(height * 0.85));
      }
    }

    return blobToDataUrl(blob || file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function createValidationForm(form) {
  const mapImages = (images) =>
    (images || []).map((image) => (isLocalImageEntry(image) ? "__LOCAL_UPLOAD__" : image));

  return {
    ...form,
    dark_images: mapImages(form.dark_images),
    light_images: mapImages(form.light_images)
  };
}

async function createInlineFallbackForm(form) {
  async function mapImages(images) {
    const nextImages = [];

    for (const image of images || []) {
      if (isLocalImageEntry(image)) {
        nextImages.push(await compressFileForInlineFallback(image.file));
      } else {
        nextImages.push(image);
      }
    }

    return nextImages;
  }

  return {
    ...form,
    dark_images: await mapImages(form.dark_images),
    light_images: await mapImages(form.light_images)
  };
}

function ProductsPage({ error, isLoading, onProductsRefresh, products }) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(createEmptyProductForm(products));
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  useEffect(() => {
    if (editingId) return;

    setForm((current) => {
      const isPristine =
        !current.name &&
        !current.category &&
        !current.subcategory &&
        !current.description &&
        current.light_images.length === 0 &&
        current.dark_images.length === 0 &&
        !current.colors &&
        !current.quality &&
        !current.quality_points &&
        current.buy_price === "" &&
        current.rent_price_per_day === "" &&
        String(current.quantity_available) === "0" &&
        String(current.reorder_level) === "0" &&
        String(current.unit_cost) === "0" &&
        String(current.overhead_cost) === "0" &&
        current.size_mode === "one-size" &&
        !current.sizes &&
        current.customizable === false &&
        current.variations.length === 1 &&
        !current.variations[0].color &&
        String(current.variations[0].quantity) === "0" &&
        !current.variations[0].sku &&
        current.buy_enabled === true &&
        current.rent_enabled === false &&
        current.featured === false &&
        current.active === true;

      if (!isPristine) {
        return current;
      }

      const nextProductId = generateNextProductId(products);
      if (current.product_id === nextProductId) {
        return current;
      }

      return {
        ...current,
        product_id: nextProductId
      };
    });
  }, [editingId, products]);

  function resetForm(nextProducts = products) {
    revokeFormPreviewUrls(form);
    setEditingId(null);
    setForm(createEmptyProductForm(nextProducts));
    setPageError("");
  }

  function handleChange(event) {
    const { checked, name, type, value } = event.target;
    let nextValue = type === "checkbox" ? checked : value;

    if (name === "product_id") {
      nextValue = normalizeProductIdInput(nextValue);
    }

    if (name === "currency") {
      nextValue = normalizeCurrencyCodeInput(nextValue);
    }

    setForm((current) => {
      const nextForm = {
        ...current,
        [name]: nextValue
      };

      if (name === "size_mode") {
        const nextMode = nextValue === "varied" ? "varied" : "one-size";
        nextForm.size_mode = nextMode;
        nextForm.sizes = nextMode === "one-size" ? "" : current.sizes;
      }

      if (name === "colors" || name === "sizes" || name === "size_mode") {
        const baseVariations = current.variations.length
          ? current.variations
          : [createEmptyVariationRow(nextForm.size_mode)];
        nextForm.variations = syncVariationRows(baseVariations, nextForm);
        nextForm.quantity_available = getVariationTotal(nextForm.variations, nextForm.size_mode);
      }

      return nextForm;
    });
  }

  function handleVariationChange(index, field, value) {
    setForm((current) => {
      const variations = current.variations.map((variation, variationIndex) =>
        variationIndex === index
          ? {
              ...variation,
              availability_status:
                field === "quantity"
                  ? getDerivedVariationAvailability(value)
                  : getDerivedVariationAvailability(variation.quantity),
              [field]: field === "size" && current.size_mode === "one-size" ? ONE_SIZE_LABEL : value
            }
          : variation
      );

      return {
        ...current,
        quantity_available: getVariationTotal(variations, current.size_mode),
        variations
      };
    });
    setNotice("");
    setPageError("");
  }

  function handleAddVariation() {
    setForm((current) => {
      const variations = [...current.variations, createEmptyVariationRow(current.size_mode)];
      return {
        ...current,
        quantity_available: getVariationTotal(variations, current.size_mode),
        variations
      };
    });
  }

  function handleRemoveVariation(indexToRemove) {
    setForm((current) => {
      const variations =
        current.variations.length === 1
          ? [createEmptyVariationRow(current.size_mode)]
          : current.variations.filter((_, index) => index !== indexToRemove);

      return {
        ...current,
        quantity_available: getVariationTotal(variations, current.size_mode),
        variations
      };
    });
  }

  async function handleImageSelect(themeMode, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const fieldName = themeMode === "dark" ? "dark_images" : "light_images";
    const currentCount = form[fieldName]?.length || 0;

    if (currentCount + files.length > MAX_IMAGES_PER_MODE) {
      setPageError(`You can upload up to ${MAX_IMAGES_PER_MODE} ${themeMode} mode images per product.`);
      return;
    }

    const invalidFile = files.find((file) => !String(file.type || "").startsWith("image/"));
    if (invalidFile) {
      setPageError("Only image files can be uploaded for product galleries.");
      return;
    }

    const oversizedFile = files.find((file) => Number(file.size || 0) > MAX_PRODUCT_IMAGE_BYTES);
    if (oversizedFile) {
      setPageError("Each uploaded image must be 5 MB or smaller.");
      return;
    }

    try {
      setForm((current) => ({
        ...current,
        [fieldName]: [...current[fieldName], ...files.map(createLocalImageEntry)]
      }));
      setNotice("");
      setPageError("");
    } catch (uploadError) {
      setPageError(uploadError?.message || "Unable to read the selected image files.");
    }
  }

  function handleImageRemove(themeMode, indexToRemove) {
    const fieldName = themeMode === "dark" ? "dark_images" : "light_images";
    const removedImage = form[fieldName]?.[indexToRemove];

    revokeLocalImageEntry(removedImage);

    setForm((current) => ({
      ...current,
      [fieldName]: current[fieldName].filter((_, index) => index !== indexToRemove)
    }));
    setNotice("");
    setPageError("");
  }

  function handleBlur(event) {
    const { name } = event.target;

    if (name === "product_id" && !form.product_id.trim()) {
      setForm((current) => ({
        ...current,
        product_id: generateNextProductId(products)
      }));
    }

    if (name === "currency" && !form.currency.trim()) {
      setForm((current) => ({
        ...current,
        currency: "EGP"
      }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const wasEditing = Boolean(editingId);
    let productSaved = false;
    const uploadedUrls = [];

    setIsSaving(true);
    setNotice("");
    setPageError("");

    try {
      buildProductPayload(createValidationForm(form), { editingId, products });

      const uploadImages = async (themeMode, images) => {
        const nextUrls = [];

        for (const image of images || []) {
          if (isLocalImageEntry(image)) {
            const uploadedUrl = await uploadProductImage(image.file, {
              productId: form.product_id,
              themeMode
            });
            uploadedUrls.push(uploadedUrl);
            nextUrls.push(uploadedUrl);
            continue;
          }

          nextUrls.push(image);
        }

        return nextUrls;
      };

      let preparedForm = null;

      try {
        preparedForm = {
          ...form,
          dark_images: await uploadImages("dark", form.dark_images),
          light_images: await uploadImages("light", form.light_images)
        };
      } catch (uploadError) {
        if (!isMissingImageUploadEndpointError(uploadError)) {
          throw uploadError;
        }

        if (uploadedUrls.length) {
          await deleteUploadedImages(uploadedUrls).catch(() => {});
          uploadedUrls.length = 0;
        }

        preparedForm = await createInlineFallbackForm(form);
      }

      const payload = buildProductPayload(preparedForm, { editingId, products });

      try {
        await saveProduct(payload, editingId);
      } catch (saveError) {
        saveError.productActionStage = saveError.productActionStage || "save";
        throw saveError;
      }

      productSaved = true;
      let nextProducts = null;

      try {
        nextProducts = await onProductsRefresh();
      } catch (refreshError) {
        refreshError.productActionStage = refreshError.productActionStage || "refresh";
        throw refreshError;
      }

      resetForm(nextProducts);
      setNotice(wasEditing ? "Product updated successfully." : "Product created successfully.");
    } catch (submitError) {
      if (!productSaved && uploadedUrls.length) {
        await deleteUploadedImages(uploadedUrls).catch(() => {});
      }
      setPageError(formatProductActionError(submitError));
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(product) {
    revokeFormPreviewUrls(form);
    setEditingId(product.id);
    setForm(buildFormFromProduct(product));
    setNotice("");
    setPageError("");
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  async function handleDelete(product) {
    const confirmed = window.confirm(`Delete "${product.name}"?`);
    if (!confirmed) return;

    setNotice("");
    setPageError("");

    try {
      await removeProduct(product.id);
      const nextProducts = await onProductsRefresh();
      if (editingId === product.id) {
        resetForm(nextProducts);
      }
      setNotice("Product deleted successfully.");
    } catch (deleteError) {
      setPageError(deleteError?.message || "Unable to delete product.");
    }
  }

  const filteredProducts = products.filter((product) =>
    productMatchesSearch(product, deferredSearch)
  );

  return (
    <section className="admin-section">
      <div className="section-head">
        <div>
          <h2>Products</h2>
          <p className="muted">Add, update, or delete products with the shared API.</p>
        </div>
      </div>

      <div className="section-stack">
        {error ? (
          <div className="feedback-panel error">
            <strong>Products could not be refreshed.</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {pageError ? (
          <div className="feedback-panel error">
            <strong>There was a problem with the last product action.</strong>
            <span>{pageError}</span>
          </div>
        ) : null}

        {notice ? (
          <div className="feedback-panel success">
            <strong>Catalog updated.</strong>
            <span>{notice}</span>
          </div>
        ) : null}

        <ProductForm
          form={form}
          isEditing={Boolean(editingId)}
          isSaving={isSaving}
          onBlur={handleBlur}
          onChange={handleChange}
          onAddVariation={handleAddVariation}
          onImageRemove={handleImageRemove}
          onImageSelect={handleImageSelect}
          onRemoveVariation={handleRemoveVariation}
          onReset={() => resetForm()}
          onSubmit={handleSubmit}
          onVariationChange={handleVariationChange}
        />

        <ProductList
          isLoading={isLoading}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onSearchChange={setSearch}
          products={filteredProducts}
          search={search}
        />
      </div>
    </section>
  );
}

export default ProductsPage;
