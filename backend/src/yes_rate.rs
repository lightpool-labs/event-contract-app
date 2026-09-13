// Copyright (c) LightPool Labs
// Author: xiaoyu1998

use crate::models::SpotBook;

/// Mark Yes price in cents (0-100): last trade if present, else (best bid + best ask) / 2.
pub fn yes_rate_from_book(book: &SpotBook) -> Option<String> {
    if let Some(last) = book.last_trade_price.as_deref() {
        if let Some(value) = parse_positive(last) {
            return Some(format_rate(value));
        }
    }

    let best_bid = book.bids.first().and_then(|level| parse_positive(&level.price));
    let best_ask = book.asks.first().and_then(|level| parse_positive(&level.price));

    match (best_bid, best_ask) {
        (Some(bid), Some(ask)) => Some(format_rate((bid + ask) / 2.0)),
        (Some(bid), None) => Some(format_rate(bid)),
        (None, Some(ask)) => Some(format_rate(ask)),
        (None, None) => None,
    }
}

fn parse_positive(raw: &str) -> Option<f64> {
    let value = raw.trim().parse::<f64>().ok()?;
    if value.is_finite() && value > 0.0 {
        Some(value)
    } else {
        None
    }
}

fn format_rate(value: f64) -> String {
    let rounded = (value * 10_000.0).round() / 10_000.0;
    let text = format!("{rounded:.4}");
    text.trim_end_matches('0')
        .trim_end_matches('.')
        .to_string()
}
