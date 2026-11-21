import { Wrench, Zap, Sparkles, Paintbrush, Scissors, Sprout, WashingMachine, Hammer, Wind, Bug, Truck, Car, Grid2X2 } from "lucide-react";
import { isAxiosError } from "axios";

export const categories = [
  { name: "Plumbing", icon: Wrench, detail: "Leaks to installations", color: "blue" },
  { name: "Electrical", icon: Zap, detail: "Power up your space", color: "amber" },
  { name: "Cleaning", icon: Sparkles, detail: "A fresh start at home", color: "teal" },
  { name: "Painting", icon: Paintbrush, detail: "Bring colour to life", color: "purple" },
  { name: "Gardening", icon: Sprout, detail: "Lawns and green spaces", color: "green" },
  { name: "Appliance Repair", icon: WashingMachine, detail: "Get it working again", color: "blue" },
  { name: "House Cleaning", icon: Sparkles, detail: "Care for your space", color: "teal" },
  { name: "Hairdressing", icon: Scissors, detail: "Cuts and styling", color: "pink" },
  { name: "Carpentry", icon: Hammer, detail: "Woodwork and repairs", color: "amber" },
  { name: "Air Conditioning", icon: Wind, detail: "Keep your cool", color: "blue" },
  { name: "Handyman", icon: Wrench, detail: "Everyday home repairs", color: "purple" },
  { name: "Pest Control", icon: Bug, detail: "Help with unwanted pests", color: "green" },
  { name: "Tiling", icon: Grid2X2, detail: "Walls and floors", color: "purple" },
  { name: "Moving Services", icon: Truck, detail: "Help with your move", color: "amber" },
  { name: "Car Washing", icon: Car, detail: "A clean finish", color: "teal" },
  { name: "Beauty", icon: Scissors, detail: "A little time for you", color: "pink" },
];

export const money = (value: number) => new Intl.NumberFormat("en-ZA", {
  style: "currency", currency: "ZAR", maximumFractionDigits: 2,
}).format(value);

export const errorMessage = (error: unknown, fallback: string) =>
  isAxiosError<{ message?: string }>(error) ? error.response?.data?.message || fallback : fallback;
