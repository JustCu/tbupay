import { newsRepository } from "../../../infrastructure/repositories/newsRepository";

export const getNews = (options = {}) => newsRepository.getAll(options);

export const createNews = (payload) => newsRepository.add(payload);

export const getNewsReplies = (id_berita, options = {}) =>
  newsRepository.getReplies(id_berita, options);

export const createNewsReply = (payload) => newsRepository.addReply(payload);

export const updateNews = (payload) => newsRepository.update(payload);

export const deleteNews = (id_berita, created_by_role) => newsRepository.delete(id_berita, created_by_role);
