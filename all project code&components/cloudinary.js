const cloudinary = require('cloudinary');

cloudinary.config({ // JENNIFER     IMPORTANT : SEE DISCORD ABOUT THIS
    cloud_name: "",
    api_key: "",
    api_secret: ""
  });

module.exports = cloudinary;


