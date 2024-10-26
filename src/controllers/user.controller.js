import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/users.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
  console.log(email, username, password);
  if(!(username || email)) {
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

const logoutUser = asyncHandler(async (req,res)=>{
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $unset: {
          refreshToken: undefined
        }
      },
      {
        new: true
      }
    )
    const options = {
      httpOnly: true,
      secure: true
    }
    return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json(
              new ApiResponse(200, {}, "User logged out successfully")
            )
});

export { registerUser, loginUser, logoutUser};
