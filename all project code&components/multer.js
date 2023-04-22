const multer = require('multer');

module.exports = multer({
  storage: multer.diskStorage({}),
  limits: { fileSize: 10000000 }
});