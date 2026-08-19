"use strict";

const templateSupportedExtensions = [".fdf", ".pdf"];

var pdfConverter = require("html-pdf-node");

const generatePdfFromHtml = async (html, headerTemplate, footerTemplate) => {
  let options = {
    format: "A4",
    printBackground: true,
    margin: {
      top: "85px",
      bottom: "70px",
      left: "0px",
      right: "30px",
    },
  };

  if (headerTemplate || footerTemplate) {
    options.displayHeaderFooter = true;
    if (headerTemplate) {
      options.headerTemplate = headerTemplate;
    }
    if (footerTemplate) {
      options.footerTemplate = footerTemplate;
    }
  }
  //console.log("options", options);

  let htmlContent = { content: html };
  let pdfBuffer = await pdfConverter
    .generatePdf(htmlContent, options)
    .then((pdfBuffer) => {
      //console.log("PDF Buffer:-", pdfBuffer);

      return pdfBuffer;
    })
    .catch((error) => {
      console.log(error);

      return null;
    });

  return pdfBuffer;
};

module.exports = {
  templateSupportedExtensions,
  generatePdfFromHtml,
};
