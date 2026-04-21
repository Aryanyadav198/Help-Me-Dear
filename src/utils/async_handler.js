const asyncHandler = (fn) => {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
  
  export { asyncHandler };
// const asyncHandler = (fun) => (req, res, next)=>{
//     Promise.resolve(fun(req,res,next)).catch((error)=>next(error));
// }
// export {asyncHandler}
