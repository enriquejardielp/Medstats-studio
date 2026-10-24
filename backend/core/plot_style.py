"""Shared visual style for R plots returned by statistical analyses."""

R_PLOT_STYLE = r'''
medstats_palette <- c("#A65336", "#D77A4A", "#718477", "#7B8190", "#C29A63", "#9A716B")
theme_medstats <- ggplot2::theme_minimal(base_size = 13) +
  ggplot2::theme(
    plot.background = ggplot2::element_rect(fill = "#FFFFFF", colour = NA),
    panel.background = ggplot2::element_rect(fill = "#FFFFFF", colour = NA),
    plot.title = ggplot2::element_text(size = 16, face = "bold", colour = "#352F2B", margin = ggplot2::margin(b = 6)),
    plot.subtitle = ggplot2::element_text(size = 11, colour = "#716860", margin = ggplot2::margin(b = 12)),
    axis.title = ggplot2::element_text(size = 11, face = "bold", colour = "#514941"),
    axis.text = ggplot2::element_text(size = 10, colour = "#514941"),
    axis.text.x = ggplot2::element_text(margin = ggplot2::margin(t = 7)),
    axis.text.y = ggplot2::element_text(margin = ggplot2::margin(r = 5)),
    panel.grid.major = ggplot2::element_line(colour = "#ECE7E1", linewidth = 0.55),
    panel.grid.minor = ggplot2::element_blank(),
    panel.grid.major.x = ggplot2::element_blank(),
    legend.position = "bottom",
    legend.title = ggplot2::element_blank(),
    legend.text = ggplot2::element_text(size = 10, colour = "#514941"),
    legend.key = ggplot2::element_rect(fill = "white", colour = NA),
    plot.margin = ggplot2::margin(16, 20, 14, 16)
  )

save_medstats_plot <- function(path, plot, width = 8.5, height = 5.5) {
  ggplot2::ggsave(filename = path, plot = plot, width = width, height = height,
                  units = "in", dpi = 180, bg = "white", limitsize = FALSE)
}
'''
