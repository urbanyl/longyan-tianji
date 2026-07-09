const PDFDocument = require('pdfkit');
const writeXlsxFile = require('write-excel-file/node');
const sharp = require('sharp');
const { promises: fs, createWriteStream } = require('fs');
const path = require('path');
const { clip, escapeXml, isPathInside, safeFilename, stringify } = require('./utils');

function escapeFormula(value) {
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function sanitizeExcelValue(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeExcelValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeExcelValue(item)]));
  }
  return escapeFormula(value);
}

function normalizeRows(data) {
  const rows = Array.isArray(data) ? data : [data || {}];
  return rows.map((row) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) return sanitizeExcelValue(row);
    return { value: sanitizeExcelValue(row) };
  });
}

class FileGenerator {
  constructor(config, brand) {
    this.config = config;
    this.brand = brand;
    this.ready = fs.mkdir(config.tempDir, { recursive: true });
  }

  ensureManagedPath(filepath) {
    if (!isPathInside(this.config.tempDir, filepath)) {
      throw new Error('Refusing to write outside the managed temp directory.');
    }
  }

  ensureTextBudget(content) {
    const text = typeof content === 'string' ? content : stringify(content);
    if (text.length > this.config.maxFileInputChars) {
      throw new Error(`File payload is too large. Limit: ${this.config.maxFileInputChars} characters.`);
    }
    return text;
  }

  async generatePDF(content, options = {}) {
    await this.ready;
    await this.pruneExpired();
    const filename = this.name(options.name || this.brand.bot, 'pdf');
    const filepath = path.join(this.config.tempDir, filename);
    this.ensureManagedPath(filepath);
    const title = clip(options.title || `${this.brand.project} Report`, 160);
    const body = this.ensureTextBudget(content);

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 48,
        size: 'A4',
        info: { Title: title },
        ...options.pdf
      });
      const stream = createWriteStream(filepath);
      doc.pipe(stream);
      doc.fontSize(22).text(title, { lineGap: 6 });
      doc.moveDown();
      doc.fontSize(10).fillColor('#667085').text(new Date().toISOString());
      doc.moveDown();
      doc.fillColor('#111827').fontSize(11).text(body, { lineGap: 4 });
      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return { type: 'pdf', filename, filepath };
  }

  async generateExcel(data, options = {}) {
    await this.ready;
    await this.pruneExpired();
    const filename = this.name(options.name || this.brand.bot, 'xlsx');
    const filepath = path.join(this.config.tempDir, filename);
    this.ensureManagedPath(filepath);
    this.ensureTextBudget(data || {});
    const rows = normalizeRows(data);
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    if (!keys.length) keys.push('value');
    const sheetName = clip(safeFilename(options.sheetName || this.brand.bot, this.brand.bot), 31);
    const sheetData = [
      keys.map((key) => ({ value: key, fontWeight: 'bold' })),
      ...rows.map((row) => keys.map((key) => ({ value: row[key] == null ? '' : row[key] })))
    ];

    await writeXlsxFile(sheetData, { sheet: sheetName }).toFile(filepath);
    return { type: 'excel', filename, filepath };
  }

  async generateImage(input, options = {}) {
    await this.ready;
    await this.pruneExpired();
    const filename = this.name(options.name || this.brand.bot, options.format || 'png');
    const filepath = path.join(this.config.tempDir, filename);
    this.ensureManagedPath(filepath);
    if (!Buffer.isBuffer(input)) this.ensureTextBudget(input);
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(this.svg(input, options));
    if (buffer.length > this.config.maxAttachmentBytes) {
      throw new Error(`Image input exceeds ${this.config.maxAttachmentBytes} bytes.`);
    }
    let pipeline = sharp(buffer);

    if (options.format === 'webp') pipeline = pipeline.webp({ quality: 92 });
    else if (options.format === 'jpeg' || options.format === 'jpg') pipeline = pipeline.jpeg({ quality: 92 });
    else pipeline = pipeline.png();

    await pipeline.toFile(filepath);
    return { type: 'image', filename, filepath };
  }

  async writeJSON(data, options = {}) {
    await this.ready;
    await this.pruneExpired();
    const filename = this.name(options.name || 'data', 'json');
    const filepath = path.join(this.config.tempDir, filename);
    this.ensureManagedPath(filepath);
    await fs.writeFile(filepath, `${this.ensureTextBudget(data)}\n`, 'utf8');
    return { type: 'json', filename, filepath };
  }

  async saveBuffer(buffer, extension, options = {}) {
    await this.ready;
    await this.pruneExpired();
    if (!Buffer.isBuffer(buffer)) throw new Error('Artifact buffer is invalid.');
    if (buffer.length > this.config.maxAttachmentBytes) {
      throw new Error(`Artifact exceeds ${this.config.maxAttachmentBytes} bytes.`);
    }
    const filename = this.name(options.name || 'capture', extension);
    const filepath = path.join(this.config.tempDir, filename);
    this.ensureManagedPath(filepath);
    await fs.writeFile(filepath, buffer);
    return { type: options.type || extension, filename, filepath };
  }

  svg(input, options = {}) {
    const title = escapeXml(options.title || String(input || `${this.brand.project} ${this.brand.bot}`));
    const subtitle = escapeXml(options.subtitle || `${this.brand.project} command engine`);
    return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0c111d"/><stop offset="1" stop-color="#101828"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/><rect x="54" y="54" width="1092" height="522" rx="28" fill="#111827" stroke="#f7c948" stroke-opacity=".35"/><text x="96" y="294" fill="#f7c948" font-family="Arial, sans-serif" font-size="82" font-weight="700">${title}</text><text x="100" y="364" fill="#d6e4ff" font-family="Arial, sans-serif" font-size="30">${subtitle}</text></svg>`;
  }

  name(seed, extension) {
    const ext = extension.replace(/^\./, '');
    return `${safeFilename(seed, this.brand.bot)}-${Date.now()}.${ext}`;
  }

  async cleanup() {
    await this.ready;
    const files = await fs.readdir(this.config.tempDir).catch(() => []);
    await Promise.all(files.map((file) => this.unlinkManaged(path.join(this.config.tempDir, file))));
  }

  async pruneExpired() {
    await this.ready;
    const now = Date.now();
    const files = await fs.readdir(this.config.tempDir).catch(() => []);

    await Promise.all(files.map(async (file) => {
      const filepath = path.join(this.config.tempDir, file);
      if (!isPathInside(this.config.tempDir, filepath)) return;
      const stat = await fs.stat(filepath).catch(() => null);
      if (!stat || !stat.isFile()) return;
      if (now - stat.mtimeMs > this.config.tempFileTtlMs) await this.unlinkManaged(filepath);
    }));
  }

  async unlinkManaged(filepath) {
    if (!isPathInside(this.config.tempDir, filepath)) return;
    await fs.unlink(filepath).catch(() => {});
  }
}

module.exports = FileGenerator;
