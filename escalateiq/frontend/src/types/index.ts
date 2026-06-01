/**
 * TypeScript interfaces matching all backend response shapes.
 */

export interface User {
  _id: string;
  id?: string;
  username: string;
  email?: string;
  role: 'user' | 'moderator' | 'admin';
  reputation: number;
  isBanned?: boolean;
  createdAt: string;
}

export interface Escalation {
  _id: string;
  userId: string;
  authorUsername?: string;
  authorReputation?: number;
  title: string;
  body: string;
  status: 'open' | 'answered' | 'resolved' | 'removed';
  upvoteCount: number;
  viewCount: number;
  tags: string[];
  hasUserVoted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Answer {
  _id: string;
  escalationId: string;
  userId: string;
  authorUsername?: string;
  authorReputation?: number;
  body: string;
  status: 'unverified' | 'verified' | 'rejected';
  rejectionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  upvoteCount: number;
  hasUserVoted?: boolean;
  isAuthor?: boolean;
  createdAt: string;
}

export interface FAQEntry {
  _id: string;
  question: string;
  answer: string;
  sourceEscalation?: string;
  sourceAnswer?: string;
  tags: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface Flag {
  _id: string;
  reporterId: string;
  targetId: string;
  targetType: 'escalation' | 'answer';
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  createdAt: string;
}

export interface ReputationEvent {
  _id: string;
  userId: string;
  delta: number;
  reason: string;
  refId?: string;
  createdAt: string;
}

export interface EscalationCheckResponse {
  action: 'faq_match' | 'feed_match' | 'created';
  payload:
    | { faqEntries: FAQEntry[]; generatedAnswer: string } // faq_match
    | Escalation // feed_match
    | Escalation; // created
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  limit: number;
}

export interface AdminStats {
  openEscalations: number;
  unverifiedAnswers: number;
  pendingFlags: number;
  totalUsers: number;
}
