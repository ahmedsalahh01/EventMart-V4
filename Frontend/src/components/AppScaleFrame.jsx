import { useLayoutEffect, useRef, useState } from "react";

function AppScaleFrame({ children }) {
  const rootRef = useRef(null);
  const [frameHeight, setFrameHeight] = useState(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return undefined;

    let frameId = 0;

    const updateFrameHeight = () => {
      frameId = 0;

      if (!rootRef.current) return;

      const nextHeight = Math.ceil(rootRef.current.getBoundingClientRect().height);
      setFrameHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    const scheduleUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateFrameHeight);
    };

    scheduleUpdate();

    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });

    resizeObserver.observe(rootRef.current);
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return (
    <div className="app-scale-frame" style={frameHeight ? { "--app-frame-height": `${frameHeight}px` } : undefined}>
      <div id="app-root" className="app-root" ref={rootRef}>
        {children}
      </div>
    </div>
  );
}

export default AppScaleFrame;
