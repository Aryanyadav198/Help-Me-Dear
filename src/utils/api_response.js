class ApiResponse {
  constructor(statusCode, message, data = {}, meta = {}) {
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
    this.meta = meta
  }
}

export { ApiResponse };