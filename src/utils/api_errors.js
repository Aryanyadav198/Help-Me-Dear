class ApiErrors extends Error {
    constructor(statuscode, message = "Something went wrong", errors = null) {
      super(message);
      this.success = false;
      this.statuscode = statuscode;
      this.errors = errors;
      this.message = message;
      this.data = null;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  export { ApiErrors };