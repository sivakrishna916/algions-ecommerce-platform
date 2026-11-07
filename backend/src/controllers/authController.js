const authService = require('../services/authService');
const profileService = require('../services/profileService');
const { asyncHandler, send } = require('../utils/helpers');

exports.register = asyncHandler(async (req, res) => send(res, 201, await authService.register(req.body)));
exports.login = asyncHandler(async (req, res) => send(res, 200, await authService.login(req.body)));
exports.me = asyncHandler(async (req, res) => send(res, 200, { user: req.user.toSafeJSON() }));
exports.updateMe = asyncHandler(async (req, res) => send(res, 200, { user: await profileService.updateProfile(req.user._id, req.body) }));
exports.changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body);
  send(res, 200, { message: 'Password updated' });
});
exports.listAddresses = asyncHandler(async (req, res) => send(res, 200, { addresses: await profileService.listAddresses(req.user) }));
exports.addAddress = asyncHandler(async (req, res) => send(res, 201, { address: await profileService.addAddress(req.user, req.body) }));
exports.updateAddress = asyncHandler(async (req, res) =>
  send(res, 200, { address: await profileService.updateAddress(req.user, req.params.id, req.body) }));
exports.deleteAddress = asyncHandler(async (req, res) => {
  await profileService.deleteAddress(req.user, req.params.id);
  send(res, 200, { message: 'Address removed' });
});
