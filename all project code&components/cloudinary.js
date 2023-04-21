const cloudinary = require('cloudinary');

cloudinary.config({
    cloud_name: "duelyepmz",
    api_key: "511679172543115",
    api_secret: "nUmoqZOXPfC57W0srC0Yx3Mp3WM"
  });

module.exports = cloudinary;