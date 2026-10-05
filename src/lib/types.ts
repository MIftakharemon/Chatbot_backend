export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  role: 'client' | 'admin'
  plan: string
  created_at: string
}

export interface Page {
  id: string
  owner_id: string
  fb_page_id: string
  page_name: string
  page_avatar_url: string | null
  access_token: string
  token_expires_at: string | null
  is_active: boolean
  connected_at: string
}

/** Page row without the secret token — safe to send to the client. */
export type PublicPage = Omit<Page, 'access_token'>

export interface Product {
  id: string
  page_id: string
  name: string
  description: string | null
  price: number
  sizes: string[]
  colors: string[]
  stock: number
  image_url: string | null
  sku: string | null
  is_active: boolean
  created_at: string
}

export interface BotSettings {
  page_id: string
  welcome_message: string
  fallback_message: string
  delivery_inside: number
  delivery_outside: number
  payment_methods: string[]
  auto_comment_reply: boolean
  comment_reply_text: string
  bot_enabled: boolean
}

export type ConversationState =
  | 'idle'
  | 'browsing'
  | 'ask_size'
  | 'ask_qty'
  | 'ask_name'
  | 'ask_phone'
  | 'ask_address'
  | 'confirm'
  | 'order_placed'
  | 'paused'

export interface CartItem {
  product_id: string
  name: string
  price: number
  size?: string | null
  color?: string | null
  qty: number
  image_url?: string | null
}

export interface Conversation {
  id: string
  page_id: string
  psid: string
  customer_name: string | null
  customer_pfp: string | null
  state: ConversationState | string
  cart: CartItem[]
  temp_data: Record<string, unknown>
  is_paused: boolean
  last_message_at: string
  last_inbound_at: string
  created_at: string
}

export type MessageRole = 'customer' | 'bot' | 'agent'

export interface Message {
  id: string
  page_id: string
  conversation_id: string
  psid: string
  role: MessageRole
  content: string
  created_at: string
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export interface Order {
  id: string
  page_id: string
  order_number: number
  psid: string | null
  customer_name: string
  customer_phone: string
  customer_address: string
  items: CartItem[]
  subtotal: number
  delivery_charge: number
  total: number
  status: OrderStatus
  created_at: string
}

export interface CommentReply {
  id: string
  page_id: string
  fb_comment_id: string
  post_id: string | null
  comment_text: string | null
  replied_at: string
}
