# EventMart V4

## Package Feature Notes

- Browse packages on the frontend at `/packages`.
- View a single package and upload package-item customization files at `/packages/:identifier`.
- Manage packages in the admin app at `/packages`.

## Package API

- `GET /api/packages`
- `GET /api/packages/:identifier`
- `POST /api/packages`
- `PUT /api/packages/:identifier`
- `DELETE /api/packages/:identifier`
- `POST /api/packages/preview`

## Package Customization Uploads

- Package-item customization uploads reuse `POST /api/customization-uploads`.
- Pass `package_id` and `package_item_id` query params when uploading package-item files.
- Uploaded files are stored under `Server/private-uploads/package_customization`.
