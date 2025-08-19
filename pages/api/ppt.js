import PptxGenJS from "pptxgenjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { slides } = req.body;
  const pptx = new PptxGenJS();

  slides.forEach((s) => {
    const slide = pptx.addSlide();
    slide.addText(s.title, { x: 0.5, y: 0.5, fontSize: 24, bold: true });
    slide.addText(s.content, { x: 0.5, y: 1.5, fontSize: 18 });
  });

  const buffer = await pptx.write("nodebuffer");
  res.setHeader("Content-Disposition", "attachment; filename=course.pptx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  res.send(buffer);
}
