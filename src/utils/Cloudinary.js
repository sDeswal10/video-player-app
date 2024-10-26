import {v2 as cloudinary} from "cloudinary";
import fs from "fs"

cloudinary.config({
    cloud_name: "dbyoerpm1",
    api_key: 181142958188866,
    api_secret: "tcGsWkWbNW8lIsZ4JTfdovUXuEM",
    secure: true,
});

const uploadOnCloudinary = async (localFilePath)=>{
    try {
        if(!localFilePath) return null; //if file path is not defined
        //successful upload on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {resource_type: "auto"});
        // console.log(response);
        fs.unlinkSync(localFilePath, (err)=>{
            if(err){
                console.log("Error in deletion of file: ", err)
            }else{
                console.log("File removed successfully after upload")
            }
        })
        return response;        
    } catch (error) {
        console.error("Upload error:", error);
        fs.unlink(localFilePath, (err)=>{
            if(err){
                console.log("Error in deletion of file: ", err)
            }else{
                console.log("File removed successfully because error occured")
            }
        }) //if failed to upload, file is removed from local database
        return null;                
    }
};

export {uploadOnCloudinary};