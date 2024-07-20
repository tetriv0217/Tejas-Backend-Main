import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { ApiError } from "./ApiError.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    console.log("File uploaded on cloudinary :- ", response.url);
    fs.unlinkSync(localFilePath); //remove the local saved temporary file as the upload operation got passed
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); //remove the local saved temporary file as the upload operation got failed
    return null;
  }
};
const deleteOnCloudinary = async (publicId) => {
  try {
    if (!publicId) return null;
    const response = await cloudinary.uploader.destroy(publicId);
    console.log("File deleted on cloudinary :- ", response);
    return response;
  } catch (error) {
    console.log("Error while deleting previos avatar",error);
    throw new ApiError(400,"Error while deleting")
  }
};

export { uploadOnCloudinary ,deleteOnCloudinary};
