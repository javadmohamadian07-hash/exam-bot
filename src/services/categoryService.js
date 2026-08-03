import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Student } from '../models/Student.js';

export async function createCategory(name) {
  const trimmed = name.trim();
  const existing = await Category.findOne({ name: { $regex: new RegExp(`^${trimmed}$`, 'i') } });
  if (existing) {
    throw new Error(`Category "${trimmed}" already exists.`);
  }

  const category = new Category({
    name: trimmed,
    studentIds: [],
  });

  await category.save();
  return category;
}

export async function getAllCategories() {
  return await Category.find({}).sort({ name: 1 }).populate('studentIds', 'fullName username');
}

export async function getCategoryById(categoryId) {
  return await Category.findById(categoryId).populate('studentIds', 'fullName username');
}

export async function addStudentsToCategory(categoryId, studentIds) {
  const category = await Category.findById(categoryId);
  if (!category) throw new Error('Category not found.');

  // Merge without duplicates
  const existingSet = new Set(category.studentIds.map(id => id.toString()));
  let added = 0;
  for (const sid of studentIds) {
    const sidStr = String(sid);
    if (!existingSet.has(sidStr)) {
      category.studentIds.push(new mongoose.Types.ObjectId(sidStr));
      existingSet.add(sidStr);
      added++;
    }
  }

  if (added > 0) {
    await category.save();
  }

  return { category, added };
}

export async function getStudentsInCategory(categoryId) {
  const category = await Category.findById(categoryId).populate('studentIds');
  if (!category) return null;
  return category.studentIds;
}

export async function deleteCategory(categoryId) {
  return await Category.findByIdAndDelete(categoryId);
}

export async function removeStudentFromAllCategories(studentId) {
  await Category.updateMany(
    { studentIds: studentId },
    { $pull: { studentIds: studentId } }
  );
}

export async function resolveStudentIdsFromCategories(categoryIds) {
  if (!categoryIds || categoryIds.length === 0) {
    return [];
  }

  const categories = await Category.find({ _id: { $in: categoryIds } });
  const studentIdSet = new Set();

  for (const cat of categories) {
    if (cat.studentIds && Array.isArray(cat.studentIds)) {
      cat.studentIds.forEach(id => studentIdSet.add(id.toString()));
    }
  }

  return [...studentIdSet];
}