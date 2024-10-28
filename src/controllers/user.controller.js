import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/users.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, error.message || "Error in generating token");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation of data
  // check if user is already registered: usnername and email
  // upload files : multer: avatar required
  // validation of files : avatar required
  // create a new user
  // return response

  const { username, fullName, email, password } = req.body;
  if (
    [username, fullName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with same email or username already exist.");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "User Avatar image is required.");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Failed to upload avatar image.");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    fullName,
    password,
    email,
    avatar: avatar.url,
    coverImage: coverImage.url || "",
  });
  const userData = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!userData) {
    throw new ApiError(500, "Something went wrong while registering the user.");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, userData, "New user registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // we take input from user
  // check if input is empty or not
  // check user is available in database or not using email or username
  // if user exist, generate access token and refreshToken
  // return a response
  const { username, email, password } = req.body;
  // console.log(email, username, password);
  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(
      400,
      "User doesn't exist. Please register your account."
    );
  }
  const passwordValidate = await user.isPasswordCorrect(password);
  if (!passwordValidate) {
    throw new ApiError(400, "Incorrect user login credentials.");
  }
  const { refreshToken, accessToken } = await generateAccessAndRefreshToken(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(500, "unauthorized request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken._id);
    if (!user) {
      throw new ApiError(400, error.message || "Invalid user token");
    }
    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(400, "Refresh token is used or expired");
    }
    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);
    const options = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(500, error.message || "Invalid refresh token");
  }
});

const changeUserPassword = asyncHandler(async(req,res)=>{
  const {oldPassword, newPassword} = req.body;
  if(!oldPassword || !newPassword){
    throw new ApiError(400, "Old and new password are required");
  };
  const user = await User.findById(req.user?._id);
  const isOldPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if(!isOldPasswordCorrect){
    throw new ApiError(400, "Old password is wrong")
  }
  user.password = newPassword;
  user.save({validateBeforeSave: false});
  return res
            .status(200)
            .json(new ApiResponse(200, {}, "Password changed successfully."))
});

const updateUserDetails = asyncHandler(async(req,res)=>{
  const {fullName, email} = req.body;
  if(!fullName || !email){
    throw new ApiError(400, "fullname and email fields are required")
  }
  const user = await User.findByIdAndUpdate(
    req.body?._id,
    {
      $set: {
        fullName,
        email
      }
    },
    {new: true}
  ).select("-password");
  return res
        .status(200)
        .json(
          new ApiResponse(200, user, "Account details updated successfully")
        )
});

const updateUserAvatar = asyncHandler(async(req,res)=>{
  const newAvatarFilePath = req.file?.path;
  if(!newAvatarFilePath){
    throw new ApiError(400, "Please select a avatar to upload")
  }
  const avatar = await uploadOnCloudinary(newAvatarFilePath);
  if(!avatar.url){
    throw new ApiError(400, "Invalid avatar image url")
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    },
    {new: true}
  ).select("-password");
  return res
        .status(200)
        .json(
          new ApiResponse(200, user, "Avatar updates successfully.")
        )
});

const updateUserCoverImage = asyncHandler(async (req,res)=>{
  const newCoverImageLocalPath = req.file?.path;
  if(!newCoverImageLocalPath){
    throw new ApiError(404, "Cover image is required")
  }
  const coverImage = await uploadOnCloudinary(newCoverImageLocalPath);
  if(!coverImage.url){
    throw new ApiError(400, "New cover image url is not found")
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage?.url
      }
    },
    {
      new: true
    }
  ).select("-password");
  return res
        .status(200)
        .json(
          new ApiResponse(200, user, "Cover image updated successfully")
        )
});

const getCurrentUser = asyncHandler(async (req,res)=>{
  return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            req.user,
            "User fetched successfullly"
          )
        )
})



export { registerUser, 
  loginUser, 
  logoutUser, 
  refreshAccessToken, 
  changeUserPassword, 
  updateUserDetails, 
  updateUserAvatar, 
  updateUserCoverImage, 
  getCurrentUser
};
