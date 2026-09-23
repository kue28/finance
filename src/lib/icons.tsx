import {
  ArrowLeftRight, Baby, Banknote, Beef, Bike, BookOpen, Briefcase, Bus, Car, Church, CircleDollarSign, CircleEllipsis,
  Coffee, Cookie, Droplets, Dog, Dumbbell, Flame, Flower2, Fuel, Gamepad2, Gift, GraduationCap, Hammer, HandCoins,
  Heart, House, Landmark, Laptop, NotebookPen, Package, Percent, PiggyBank, Pill, Plane, Receipt, Scissors, Shirt,
  ShoppingCart, Signal, Smartphone, Sparkles, Stethoscope, Store, Tag, Ticket, TrainFront, Tv, User, UserX, Users,
  Utensils, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from 'lucide-react';
import type { AccountType, Category, ID } from '../db/types';

// Icons for categories and accounts (Lucide line icons; only these are bundled).
// A category stores an icon *key*; unknown or missing keys fall back sensibly.

export const iconSet: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart, utensils: Utensils, cookie: Cookie, beef: Beef, coffee: Coffee,
  bus: Bus, 'train': TrainFront, car: Car, bike: Bike, fuel: Fuel, wrench: Wrench, plane: Plane,
  house: House, zap: Zap, droplets: Droplets, flame: Flame, hammer: Hammer,
  smartphone: Smartphone, signal: Signal, wifi: Wifi,
  heart: Heart, users: Users, church: Church, gift: Gift, flower: Flower2, baby: Baby,
  user: User, shirt: Shirt, scissors: Scissors, pill: Pill, stethoscope: Stethoscope, dumbbell: Dumbbell,
  'graduation-cap': GraduationCap, 'book-open': BookOpen, 'notebook-pen': NotebookPen,
  tv: Tv, ticket: Ticket, gamepad: Gamepad2, dog: Dog, sparkles: Sparkles,
  receipt: Receipt, 'hand-coins': HandCoins, percent: Percent, landmark: Landmark,
  package: Package, 'user-x': UserX, 'circle-ellipsis': CircleEllipsis, tag: Tag,
  briefcase: Briefcase, store: Store, laptop: Laptop, 'circle-dollar': CircleDollarSign,
  wallet: Wallet, banknote: Banknote, 'piggy-bank': PiggyBank,
};

/** Default icon for each built-in category name (used for new installs and to upgrade existing data). */
export const defaultCategoryIcons: Record<string, string> = {
  // Main expense categories
  Food: 'utensils', Transport: 'bus', Housing: 'house', Communication: 'smartphone',
  'Family & Giving': 'heart', Personal: 'user', Education: 'graduation-cap', Entertainment: 'tv',
  Charges: 'receipt',
  // Subcategories
  Groceries: 'shopping-cart', 'Eating out': 'utensils', Snacks: 'cookie', 'Meat/butchery': 'beef',
  Kombi: 'bus', Fuel: 'fuel', 'Taxi/Ride-hailing': 'car', 'Vehicle maintenance': 'wrench',
  Rent: 'house', ZESA: 'zap', 'Water/Council rates': 'droplets', Gas: 'flame', Repairs: 'hammer',
  Airtime: 'smartphone', 'Data bundles': 'signal', 'WiFi/Internet': 'wifi',
  'Family support': 'users', 'Tithe/Church': 'church', Gifts: 'gift', 'Funerals and events': 'flower',
  Clothing: 'shirt', 'Grooming/Salon': 'scissors', 'Health/Pharmacy': 'pill', 'Medical aid': 'stethoscope',
  'School fees': 'graduation-cap', 'Books and stationery': 'book-open', Courses: 'notebook-pen',
  Subscriptions: 'tv', Outings: 'ticket', Hobbies: 'gamepad',
  'Mobile money fees': 'hand-coins', IMTT: 'percent', 'Bank charges': 'landmark',
  Miscellaneous: 'package', 'Bad debts': 'user-x',
  // Income
  Salary: 'briefcase', 'Side business': 'store', Freelance: 'laptop', 'Gifts received': 'gift',
};

/** Name-based default, with the two ambiguous names resolved by kind/level. */
export function defaultIconFor(name: string, kind: Category['kind'], isMain: boolean): string | undefined {
  if (name === 'Other') return isMain && kind === 'expense' ? 'circle-ellipsis' : kind === 'income' ? 'circle-dollar' : undefined;
  if (name === 'Gifts' && kind === 'income') return 'gift';
  return defaultCategoryIcons[name];
}

/** A subcategory without its own icon uses its main category's icon. */
export function categoryIcon(cat: Category | undefined, categories: Map<ID, Category>): LucideIcon {
  if (!cat) return Tag;
  const own = cat.icon && iconSet[cat.icon];
  if (own) return own;
  const parent = cat.parentId ? categories.get(cat.parentId) : undefined;
  return (parent?.icon && iconSet[parent.icon]) || Tag;
}

export const accountIcons: Record<AccountType, LucideIcon> = {
  mobile_wallet: Smartphone, cash: Banknote, bank: Landmark, savings: PiggyBank,
};

export { ArrowLeftRight as TransferIcon, PiggyBank as GoalIcon, HandCoins as LoanIcon, UserX as WriteOffIcon };
