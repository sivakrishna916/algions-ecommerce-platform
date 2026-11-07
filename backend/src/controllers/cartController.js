const cart = require('../services/cartService');
const { asyncHandler, send } = require('../utils/helpers');

exports.get = asyncHandler(async (req, res) => send(res, 200, { cart: await cart.view(req.user._id) }));
exports.add = asyncHandler(async (req, res) => send(res, 201, { cart: await cart.addItem(req.user._id, req.body) }));
exports.setQty = asyncHandler(async (req, res) => send(res, 200, { cart: await cart.setQuantity(req.user._id, req.body) }));
exports.remove = asyncHandler(async (req, res) => send(res, 200, { cart: await cart.removeItem(req.user._id, req.params.productId, req.params.sku) }));
exports.clear = asyncHandler(async (req, res) => send(res, 200, { cart: await cart.clear(req.user._id) }));
exports.applyCoupon = asyncHandler(async (req, res) => send(res, 200, { cart: await cart.applyCoupon(req.user._id, req.body.code) }));
exports.removeCoupon = asyncHandler(async (req, res) => send(res, 200, { cart: await cart.removeCoupon(req.user._id) }));
