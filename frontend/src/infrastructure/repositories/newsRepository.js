import { backendApiAdapter } from "../adapters/backendApiAdapter";
import { toNewsModel, toNewsReplyModel } from "../../domain/models/newsModel";
import { mapListResponseData } from "../../domain/mappers/apiResponseMappers";

export const newsRepository = {
  async getAll(options = {}) {
    const response = await backendApiAdapter.get("getNews", {}, options);
    return mapListResponseData(response, toNewsModel);
  },

  add(payload) {
    return backendApiAdapter.post("addNews", payload);
  },

  async getReplies(id_berita, options = {}) {
    const response = await backendApiAdapter.get(
      "getNewsReplies",
      {
        id_berita,
      },
      options,
    );
    return mapListResponseData(response, toNewsReplyModel);
  },

  addReply(payload) {
    return backendApiAdapter.post("addNewsReply", payload);
  },

  update(payload) {
    return backendApiAdapter.post("editNews", payload);
  },

  delete(id_berita, created_by_role) {
    return backendApiAdapter.post("deleteNews", { id_berita, created_by_role });
  },
};
