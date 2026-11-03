import { API_ENDPOINTS, apiGet, apiPost } from '../utils/api';

export interface RatingSubmission {
  bookingId: string;
  tripId: string;
  driverId: string;
  rating: number;
  review?: string;
  tags?: string[];
}

export interface DriverRating {
  averageRating: number;
  totalRatings: number;
  recentReviews: Array<{
    rating: number;
    review: string;
    tags: string[];
    createdAt: string;
  }>;
}

class RatingsService {
  async submitRating(submission: RatingSubmission): Promise<void> {
    if (!Number.isFinite(submission.rating) || submission.rating < 1 || submission.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    await apiPost(API_ENDPOINTS.RATINGS, {
      bookingId: submission.bookingId,
      // The API resolves trip and driver from the persisted booking; client values
      // are deliberately omitted from the write contract.
      rating: submission.rating,
      review: submission.review,
      tags: submission.tags ?? [],
    });
  }

  async getDriverRating(driverId: string): Promise<DriverRating> {
    return apiGet<DriverRating>(API_ENDPOINTS.RATINGS_DRIVER(encodeURIComponent(driverId)));
  }

  async canRateBooking(bookingId: string): Promise<{ canRate: boolean; reason?: string }> {
    return apiGet<{ canRate: boolean; reason?: string }>(
      API_ENDPOINTS.RATINGS_ELIGIBILITY(encodeURIComponent(bookingId)),
    );
  }
}

export const ratingsService = new RatingsService();
