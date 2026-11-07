const User = require('../models/User');
const { notFound } = require('../utils/AppError');

async function updateProfile(userId, patch) {
  const user = await User.findByIdAndUpdate(userId, { $set: patch }, { new: true, runValidators: true });
  if (!user) throw notFound('User');
  return user.toSafeJSON();
}

const listAddresses = async (user) => user.addresses;

function applyDefault(user, addr) {
  if (addr.isDefault) user.addresses.forEach((a) => { if (a._id.toString() !== addr._id.toString()) a.isDefault = false; });
}

async function addAddress(user, data) {
  if (user.addresses.length === 0) data.isDefault = true; // first address becomes default
  user.addresses.push(data);
  const addr = user.addresses[user.addresses.length - 1];
  applyDefault(user, addr);
  await user.save();
  return addr;
}

async function updateAddress(user, id, data) {
  const addr = user.addresses.id(id);
  if (!addr) throw notFound('Address');
  addr.set(data);
  applyDefault(user, addr);
  await user.save();
  return addr;
}

async function deleteAddress(user, id) {
  const addr = user.addresses.id(id);
  if (!addr) throw notFound('Address');
  const wasDefault = addr.isDefault;
  addr.deleteOne();
  if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
  await user.save();
}

module.exports = { updateProfile, listAddresses, addAddress, updateAddress, deleteAddress };
