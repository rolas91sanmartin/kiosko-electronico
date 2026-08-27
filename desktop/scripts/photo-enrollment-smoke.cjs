const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { PhotoEnrollmentService } = require('../dist-electron/electron/application/photo-enrollment-service.js');

const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
const employee = { code: '0123', name: 'Empleado de prueba', payrollCode: 1, photoDataUrl: null };

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'kiosk-photo-test-'));
  try {
    let update;
    const successRepository = {
      updateEmployeePhoto: async (...args) => { update = args; }
    };
    const service = new PhotoEnrollmentService(successRepository, { kiosk: { photoDirectory: directory } });
    await service.save({ employee, imageDataUrl: jpeg });
    assert.deepEqual(update, [1, '0123', '123.JPG']);
    assert.equal((await fs.readFile(path.join(directory, '123.JPG'))).subarray(0, 3).toString('hex'), 'ffd8ff');

    await fs.writeFile(path.join(directory, '123.JPG'), 'FOTO-ANTERIOR');
    const failureRepository = { updateEmployeePhoto: async () => { throw new Error('Fallo simulado'); } };
    const failingService = new PhotoEnrollmentService(failureRepository, { kiosk: { photoDirectory: directory } });
    await assert.rejects(() => failingService.save({ employee, imageDataUrl: jpeg }), /Fallo simulado/);
    assert.equal(await fs.readFile(path.join(directory, '123.JPG'), 'utf8'), 'FOTO-ANTERIOR');
    console.log('Photo enrollment smoke test: OK');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
