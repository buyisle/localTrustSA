const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { portfolioImage } = require('./portfolio');

const root = path.resolve(__dirname, '../private-uploads/bookings');
const filenamePattern = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;
const photoPath = filename => path.join(root, filename);

function validate(photos = []) {
  if (!Array.isArray(photos) || photos.length > 3) throw Error('Choose up to three booking photos.');
  return photos.map(portfolioImage);
}

async function remove(filenames) {
  await Promise.allSettled(filenames.map(filename => fs.unlink(photoPath(filename))));
}

async function store(images) {
  if (!images.length) return [];
  await fs.mkdir(root, { recursive: true });
  const filenames = [];
  try {
    for (const { bytes, extension } of images) {
      const filename = randomUUID() + '.' + extension;
      await fs.writeFile(photoPath(filename), bytes, { flag: 'wx' });
      filenames.push(filename);
    }
    return filenames;
  } catch (error) {
    await remove(filenames);
    throw error;
  }
}

module.exports = { validate, store, remove, filenamePattern, photoPath };
