/** The public landing page content: posts and home pictures. */

import { api, type BodyArgs, type PathParam, type QueryArgs } from "../../shared/lib/api";

export const contentApi = {
  posts: (...args: QueryArgs) =>
    api.get("/content/announcements", ...args),
  createPost: (...args: BodyArgs) =>
    api.post("/content/announcements", ...args),
  updatePost: (postId: PathParam, ...args: BodyArgs) =>
    api.post(`/content/announcements/${postId}`, ...args),
  deletePost: (postId: PathParam, ...args: QueryArgs) =>
    api.delete(`/content/announcements/${postId}`, ...args),
  reorderPosts: (...args: BodyArgs) =>
    api.post("/content/announcements/reorder", ...args),
  heroSlides: (...args: QueryArgs) =>
    api.get("/content/hero-slides", ...args),
  createHeroSlide: (...args: BodyArgs) =>
    api.post("/content/hero-slides", ...args),
  updateHeroSlide: (slideId: PathParam, ...args: BodyArgs) =>
    api.post(`/content/hero-slides/${slideId}`, ...args),
  deleteHeroSlide: (slideId: PathParam, ...args: QueryArgs) =>
    api.delete(`/content/hero-slides/${slideId}`, ...args),
  reorderHeroSlides: (...args: BodyArgs) =>
    api.post("/content/hero-slides/reorder", ...args),
};
