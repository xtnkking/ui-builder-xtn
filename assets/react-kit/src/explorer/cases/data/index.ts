import type { ExplorerCases } from "../types";
import accordion from "./accordion.case";
import attachment from "./attachment.case";
import avatar from "./avatar.case";
import badge from "./badge.case";
import calendar from "./calendar.case";
import card from "./card.case";
import carousel from "./carousel.case";
import chart from "./chart.case";
import codeBlock from "./code-block.case";
import collapse from "./collapse.case";
import dataTable from "./data-table.case";
import description from "./description.case";
import gallery from "./gallery.case";
import list from "./list.case";
import media from "./media.case";
import meter from "./meter.case";
import overflow from "./overflow.case";
import scheduler from "./scheduler.case";
import statistic from "./statistic.case";
import status from "./status.case";
import tag from "./tag.case";
import timeline from "./timeline.case";
import tree from "./tree.case";

export const dataExplorerCases = {
  accordion: [accordion],
  attachment: [attachment],
  avatar: [avatar],
  badge: [badge],
  calendar: [calendar],
  card: [card],
  carousel: [carousel],
  chart: [chart],
  "code-block": [codeBlock],
  collapse: [collapse],
  "data-table": [dataTable],
  description: [description],
  gallery: [gallery],
  list: [list],
  media: [media],
  meter: [meter],
  overflow: [overflow],
  scheduler: [scheduler],
  statistic: [statistic],
  status: [status],
  tag: [tag],
  timeline: [timeline],
  tree: [tree],
} satisfies ExplorerCases;
