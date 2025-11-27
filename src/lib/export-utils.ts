import JSZip from 'jszip';
import { Project } from './project-manager';

export async function exportProjectAsZip(project: Project): Promise<Blob> {
    const zip = new JSZip();

    // Construct the HTML file
    // We need to ensure we include the CSS links
    const cssLinks = project.css.map(href => `<link rel="stylesheet" href="${href}">`).join('\n');

    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.name}</title>
  ${cssLinks}
  <style>
    /* Custom styles added during editing */
  </style>
</head>
<body>
  ${project.html}
</body>
</html>
  `;

    zip.file("index.html", fullHtml);

    // In a real app, we would fetch the CSS and images and bundle them.
    // For now, we rely on the absolute URLs we resolved during cloning.

    return await zip.generateAsync({ type: "blob" });
}
