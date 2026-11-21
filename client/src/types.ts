export interface User { id: string; name: string; email: string; role: "customer" | "provider" | "admin" }
export interface DemoPayment {
  reference: string;
  serviceName: string;
  method: "demo-card" | "demo-eft";
  amount: number;
  paidAt: string;
  status: "confirmed";
  receiptStatus: "pending" | "sending" | "preview" | "submitted" | "failed" | "uncertain";
  receiptAttemptedAt?: string;
}
export interface Service { biography?: string; experience?: string; offers?: Pick<Service, "_id" | "title" | "category" | "price">[]; portfolio?: {url:string;caption:string}[]; coordinates?: { type: "Point"; coordinates: [number, number] }; availability?: { days: number[]; startHour: number; endHour: number }; demo?: boolean; image?: string; distance?: number; verified?: boolean; _id: string; title: string; category: string; description: string; price: number; location: string; active?: boolean; rating?: number; reviewCount?: number; provider?: { _id: string; name: string; profilePhoto?: string } | null }
export interface Booking { photos?: string[]; demoPayment?: DemoPayment; proposedDate?: string; payment?: {method: 'cash' | 'simulation'; status: 'pending' | 'paid' | 'failed'; reference?: string}; timeline?: {_id?: string; message: string; createdAt: string; bookingStatus?: Booking["status"]}[]; _id: string; agreedPrice?: number; review?: { rating: number; comment: string; moderation?: "pending" | "approved" | "rejected" }; service?: { title: string; location: string; price: number } | null; customer?: { name: string } | null; provider?: { name: string } | null; bookingDate: string; status: "pending" | "confirmed" | "completed" | "cancelled" }
