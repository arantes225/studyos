(() => {
  "use strict";

  const BRAND = {
    blue: [24, 72, 136],
    ink: [18, 48, 85],
    muted: [100, 116, 139],
    line: [218, 230, 244],
    logoSrc: "/assets/img/logo-icone-original.png?v=pdf-brand-1"
  };

  let assetsPromise = null;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Não foi possível carregar a logo do LURIA."));
      image.src = src;
    });
  }

  async function buildAssets() {
    const image = await loadImage(BRAND.logoSrc);

    const logoCanvas = document.createElement("canvas");
    logoCanvas.width = 512;
    logoCanvas.height = 512;

    const logoContext = logoCanvas.getContext("2d");
    logoContext.clearRect(0, 0, 512, 512);
    logoContext.drawImage(image, 0, 0, 512, 512);

    const watermarkCanvas = document.createElement("canvas");
    watermarkCanvas.width = 720;
    watermarkCanvas.height = 720;

    const watermarkContext = watermarkCanvas.getContext("2d");
    watermarkContext.clearRect(0, 0, 720, 720);
    watermarkContext.globalAlpha = 0.055;
    watermarkContext.drawImage(image, 0, 0, 720, 720);
    watermarkContext.globalAlpha = 1;

    return {
      logo: logoCanvas.toDataURL("image/png"),
      watermark: watermarkCanvas.toDataURL("image/png")
    };
  }

  function getAssets() {
    if (!assetsPromise) {
      assetsPromise = buildAssets().catch((error) => {
        console.warn("Branding do PDF indisponível:", error);
        return {
          logo: null,
          watermark: null
        };
      });
    }

    return assetsPromise;
  }

  function decoratePage(doc, assets, options = {}) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const title = options.title || "";
    const subtitle = options.subtitle || "";

    if (assets?.watermark) {
      const size = 92;
      doc.addImage(
        assets.watermark,
        "PNG",
        (pageWidth - size) / 2,
        (pageHeight - size) / 2 + 4,
        size,
        size,
        undefined,
        "FAST"
      );
    }

    if (assets?.logo) {
      doc.addImage(
        assets.logo,
        "PNG",
        14,
        7.2,
        10.5,
        10.5,
        undefined,
        "FAST"
      );
    }

    doc.setTextColor(...BRAND.blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text("LURIA", 28, 11.7);

    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.7);
    doc.text("Aprenda. Conecte. Consolide.", 28, 15.2);

    if (title) {
      doc.setTextColor(...BRAND.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(title, pageWidth - 14, 11.2, { align: "right" });
    }

    if (subtitle) {
      doc.setTextColor(...BRAND.muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.text(subtitle, pageWidth - 14, 15.0, { align: "right" });
    }

    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.25);
    doc.line(14, 20.2, pageWidth - 14, 20.2);

    doc.setTextColor(15, 23, 42);
  }

  function addFooter(doc, pageNumber, totalPages) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.2);
    doc.line(14, pageHeight - 10.5, pageWidth - 14, pageHeight - 10.5);

    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.text("LURIA", 14, pageHeight - 6.3);
    doc.text(
      `${pageNumber} / ${totalPages}`,
      pageWidth - 14,
      pageHeight - 6.3,
      { align: "right" }
    );

    doc.setTextColor(15, 23, 42);
  }

  function finalize(doc) {
    const total = doc.getNumberOfPages();

    for (let page = 1; page <= total; page += 1) {
      doc.setPage(page);
      addFooter(doc, page, total);
    }
  }

  window.LuriaPdfBranding = {
    BRAND,
    getAssets,
    decoratePage,
    finalize
  };
})();
