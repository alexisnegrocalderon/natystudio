import { listAdminBookings } from "../../server/nataliaBookingApi";

export default function handler(req: any, res: any) {
  return listAdminBookings(req, res);
}
