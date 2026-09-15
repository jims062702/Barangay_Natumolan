/** The landing page content the SK keeps: posts and home pictures. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const contentApi = {
  posts: (...args: QueryArgs) =>
    api.get("/sk/announcements", ...args),
  createPost: (...args: BodyArgs) =>
    api.post("/sk/announcements", ...args),
  updatePost: (postId: PathParam, ...args: BodyArgs) =>
    api.post(`/sk/announcements/${postId}`, ...args),
  deletePost: (postId: PathParam, ...args: QueryArgs) =>
    api.delete(`/sk/announcements/${postId}`, ...args),
  reorderPosts: (...args: BodyArgs) =>
    api.post("/sk/announcements/reorder", ...args),
  heroSlides: (...args: QueryArgs) =>
    api.get("/sk/hero-slides", ...args),
  createHeroSlide: (...args: BodyArgs) =>
    api.post("/sk/hero-slides", ...args),
  updateHeroSlide: (slideId: PathParam, ...args: BodyArgs) =>
    api.post(`/sk/hero-slides/${slideId}`, ...args),
  deleteHeroSlide: (slideId: PathParam, ...args: QueryArgs) =>
    api.delete(`/sk/hero-slides/${slideId}`, ...args),
  reorderHeroSlides: (...args: BodyArgs) =>
    api.post("/sk/hero-slides/reorder", ...args),
};
