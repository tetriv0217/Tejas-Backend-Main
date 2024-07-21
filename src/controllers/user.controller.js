import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { Subscription } from "../models/subscription.model.js";
// import { v2 as cloudinary } from "cloudinary";
// import cookie from "cookie-parser";

const generateAccessandRefreshTokens = async(userId)=>{
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken()
    const refreshToken = await user.generateRefreshToken()
    user.refreshToken = refreshToken
    await user.save({validateBeforeSave:false})

    return {accessToken,refreshToken}


  } catch (error) {
    throw new ApiError(500,'Something wen wrong while generating refreshToken and access token')
  }
}

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



const loginUser = asyncHandler(async(req,res)=>{
  // req.body -> username,email,password
  // check in database if the user exists or not
  // if exists then check password
  //login and give them an access token and a refresh token
  // send cookie
  // if user doesnt exist then make them send them to create a new account

  const {email,username,password} = req.body;

  if(!(email || username)){
    throw new ApiError(400,"Username or Email is required")
  }

  const user = await User.findOne({
    $or:[{username},{email}]
  })

  if(!user){
    throw new ApiError(404,"Username or Email does not exists. Make a new account for this username or email")
  }
  
  const isPasswordValid = await user.isPasswordCorrect(password)
  if(!isPasswordValid){
    throw new ApiError(401,"Invalid password")
  }
  
  const {accessToken,refreshToken} = await generateAccessandRefreshTokens(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  const options = {
    httpOnly : true,
    secure : true,
  }

  return res
  .status(200)
  .cookie("accessToken",accessToken,options)
  .cookie("refreshToken",refreshToken,options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser,accessToken,refreshToken
      },
      "User Logged in Successfully"
    )
  )
})


const logoutUser = asyncHandler(async(req,res)=>{
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        refreshToken:undefined
      }
    },
    {
      new:true,
    }
  )
  const options = {
    httpOnly : true,
    secure : true,
  }

  return res
  .status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200,{},"User Logged Out"))
})


const refreshAccessToken = asyncHandler(async (req,res)=>{
  const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken){
    throw new ApiError(401,"Unauthorised token")
  }
  
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    )
    
    const user = await User.findById(decodedToken?._id)
    
    if(!user){
      throw new ApiError(401,"Invalid Refresh token")
    }
    
    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401,"Refresh already used token")
    }
  
    const options = {
      httpOnly:true,
      secure:true
    }
  
    const {accessToken,newRefreshToken} = await generateAccessandRefreshTokens(user._id)
  
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json(
      new ApiResponse(
        200,
        {accessToken,refreshToken:newRefreshToken,},
        'Access token refreshed'
      )
    )
  } catch (error) {
    throw new ApiError(401,error?.message || "Invalid refersh token")
  }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
  const {oldPassword,newPassword} = req.body;
  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
  if(!isPasswordCorrect){
    throw new ApiError(400,"Invalid old password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave:false})

  return res
  .status(200)
  .json(new ApiResponse(200,{},"Password Changed Successfully!!!"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
  return res
  .status(200)
  .json(
    new ApiResponse(200,req.user,"Current user fetched successfully")
  )
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
  const {fullName,email} = req.body;
  if(!(fullName || email)){
    throw new ApiError(400,"All feilds are required")
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        fullName,
        email,
      }
    },
    {new:true}
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200,user,"Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
  const avatarLocalPath =  req.file?.path
  if(!avatarLocalPath){
    throw new ApiError(400,"Avatar file is missing")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400,"Error while uploading avatar")
  }
  // added code to remove the previos url
  const user = await User.findById(req.user?._id);
  const currentAvatarUrl = user.avatar;

  // Extract the public ID of the current avatar from its URL
  const currentAvatarPublicId = currentAvatarUrl.split('/').pop().split('.')[0];

  // Delete the current avatar from Cloudinary
  if (currentAvatarPublicId) {
    await deleteOnCloudinary(currentAvatarPublicId)
  }
  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar: avatar.url,
      }
    },
    {new:true}
  ).select("-password -refreshToken")

  return res
  .status(200)
  .json(new ApiResponse(200,updatedUser,"Avatar updated successfully"))
})
const updateUserCoverImage = asyncHandler(async(req,res)=>{
  const coverImageLocalPath =  req.file?.path
  if(!coverImageLocalPath){
    throw new ApiError(400,"Cover Image file is missing")
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if(!coverImage.url){
    throw new ApiError(400,"Error while uploading Cover Image")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        coverImage: coverImage.url,
      }
    },
    {new:true}
  ).select("-password")

  return res
  .status(200)
  .json(new ApiResponse(200,user,"Cover Image updated successfully"))
})

const getChannelProfile = asyncHandler(async(req,res)=>{
  const {username} = req.params

  if(!username?.trim()){
    throw new ApiError(400,"Username is missing")
  }
  const channel = await User.aggregate([
    {
      $match:{
        username:username?.toLowerCase()
      },
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"
      },
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"subscriber",
        as:"subscribedTo"
      },
    },
    {
      $addFields:{
        subscibersCount:{
          $size:"$subscribers",
        },
        channelsSubscribedToCount:{
          $size:"$subscribedTo",
        },
        isSubscribed:{
          $cond: {
            if:{$in:[req.user?._id,"$subscribers.subscriber"]},
            then:true,
            else:false
          }
        }
      }
    },
    {
      $project:{
        fullName:1,
        email:1,
        username:1,
        subscibersCount:1,
        channelsSubscribedToCount:1,
        isSubscribed:1,
        avatar:1,
        coverImage:1
      }
    }
  ])

  if(!channel?.length){
    throw new ApiError(404,"Channel Does not exists")
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200,channel[0],"User fetched Successfully")
  )
})


export { 
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getChannelProfile
};
