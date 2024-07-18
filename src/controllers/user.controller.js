import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
const registerUser = asyncHandler(async (req, res) => {
  // Step 1:-get user details from frontend
  // Step 2:-validation 
  // Step 3:-check if user already exists : username,email
  // Step 4:-check for images and avatar,avatar should exists
  // Step 5:-upload them to cloudinary
  // Step 6:-create user object - create entry in db
  // Step 7:-remove password and refresh token feild from response
  // Step 8:-check for user creation
  // Step 10:-return res

  // Step 1
  const {fullName,email,username,password} = req.body
  console.log("Email:- ", email);

  // if(fullName === ""){
  //   throw new ApiError(400,"Full name is required")
  // }
  
  // Alternative for single checking
  //Step 2 
  if( [fullName,email,username,password].some((feild) => feild?.trim()==="")){
    throw new ApiError(400,"All feilds are required.")
  }

  //Step 3 :-  
  const existedUser = await User.findOne({
    $or: [{ username },{ email }]
  })

  console.log(existedUser);
  if(existedUser){
    throw new ApiError(409,"User with email already exists")
  }

  // Step 4 
  const avatarLocalPath =  req.files?.avatar[0]?.path
  // const coverImageLocalPath =  req.files?.coverImage[0]?.path

  let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
  if(!avatarLocalPath){
    throw new ApiError(400,"Avatar is required")
  }
  
  // Step 5
  const avatar = await uploadOnCloudinary(avatarLocalPath)
  if(!avatar){
    throw new ApiError(400,"Avatar file is required")
  }
  
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)
  
 // Step 6
  const user =  await User.create({
    fullName,
    avatar : avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(), 
  })
// Step 7
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )
  if(!createdUser){
    throw new ApiError(500,"Something went wrong while registering the user")
  }
// Step 8
  return res.status(201).json(
    new ApiResponse(200,createdUser,"User registered successfully")
  )
});

export { registerUser };
