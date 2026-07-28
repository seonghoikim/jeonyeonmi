import { Mail, Phone, Instagram, Globe } from "lucide-react";
import type { ContactItem } from "../data";

export function contactIcon(type: ContactItem["type"]) {
  if (type === "email") return <Mail size={16} />;
  if (type === "phone") return <Phone size={16} />;
  if (type === "instagram") return <Instagram size={16} />;
  return <Globe size={16} />;
}
