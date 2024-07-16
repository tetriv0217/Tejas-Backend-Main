class ApiResponse{
    constructor(statusCode,data,message,error){
        this.statusCode = statusCode,
        this.data = data,
        this.message = message,
        this.success = statusCode<400
    }
}