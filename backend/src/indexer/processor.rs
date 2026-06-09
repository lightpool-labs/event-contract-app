use lightpool_sdk::event_contract_events::{
    EventContractCreatedEvent, EventContractResolvedEvent,
};
use lightpool_sdk::spot_events::{
    OrderCancelledEvent, OrderCreatedEvent, OrderEventType, OrderFilledEvent,
};
use lightpool_sdk::{EventData, EventType, VerifiedBlock};
use uuid::Uuid;

use crate::chain::format_token_amount;
use crate::models::{Market, Order};

use super::store::{market_uuid, question_from_hash, IndexStore, SharedIndexStore};

pub async fn process_block(store: &SharedIndexStore, block: VerifiedBlock) {
    for tx_result in block.transaction_outputs {
        if !tx_result.is_success() {
            continue;
        }

        for event in &tx_result.receipt.events {
            let EventType::Call(action_name) = &event.event_type else {
                continue;
            };

            match action_name.as_str() {
                "event_contract_created" => {
                    if let EventData::Bytes(data) = &event.data {
                        if let Ok(created) =
                            bincode::deserialize::<EventContractCreatedEvent>(data)
                        {
                            index_market_created(store, created).await;
                        }
                    }
                }
                "event_contract_resolved" => {
                    if let EventData::Bytes(data) = &event.data {
                        if let Ok(resolved) =
                            bincode::deserialize::<EventContractResolvedEvent>(data)
                        {
                            store
                                .update_market_state(
                                    &resolved.market_address.to_string(),
                                    "Resolved",
                                )
                                .await;
                        }
                    }
                }
                "order_created" => {
                    if let EventData::Bytes(data) = &event.data {
                        if let Ok(created) = bincode::deserialize::<OrderCreatedEvent>(data) {
                            index_order_created(store, created).await;
                        }
                    }
                }
                "order_cancelled" => {
                    if let EventData::Bytes(data) = &event.data {
                        if let Ok(cancelled) = bincode::deserialize::<OrderCancelledEvent>(data) {
                            store
                                .update_order_cancelled(&cancelled.order_id.to_string())
                                .await;
                        }
                    }
                }
                "order_filled" => {
                    if let EventData::Bytes(data) = &event.data {
                        if let Ok(filled) = bincode::deserialize::<OrderFilledEvent>(data) {
                            store
                                .update_order_fill(
                                    &filled.order_id.to_string(),
                                    filled.fill_amount,
                                    filled.remaining_amount,
                                    filled.is_fully_filled,
                                )
                                .await;
                        }
                    }
                }
                _ => {}
            }
        }
    }
}

async fn index_market_created(store: &SharedIndexStore, created: EventContractCreatedEvent) {
    let market_address = created.market_address.to_string();
    let market = Market {
        id: market_uuid(&market_address),
        question: question_from_hash(&created.question_hash),
        market_address,
        collateral_token: created.collateral_token.to_string(),
        yes_token: created.yes_token.to_string(),
        no_token: created.no_token.to_string(),
        yes_spot_market: created.yes_spot_market.to_string(),
        no_spot_market: created.no_spot_market.to_string(),
        state: created.state.to_string(),
        resolution_deadline: created.resolution_deadline,
    };

    tracing::info!(
        market_id = %market.id,
        question = %market.question,
        "indexed event contract market"
    );

    store.upsert_market(market).await;
}

async fn index_order_created(store: &SharedIndexStore, created: OrderCreatedEvent) {
    let spot_market = created.market.to_string();
    let Some((market_id, outcome)) = store.lookup_spot_market(&spot_market).await else {
        tracing::debug!(spot_market, "order_created for unknown spot market");
        return;
    };

    let price_raw = match &created.order_type {
        OrderEventType::Limit { price, .. } => *price,
        OrderEventType::Market { .. } => 0,
        OrderEventType::Trigger { limit_price, .. } => *limit_price,
    };

    let side = match created.side {
        lightpool_sdk::OrderSide::Buy => "buy",
        lightpool_sdk::OrderSide::Sell => "sell",
    };

    let chain_order_id = created.order_id.to_string();
    let order = Order {
        id: Uuid::new_v5(
            &Uuid::NAMESPACE_OID,
            format!("{market_id}:{chain_order_id}").as_bytes(),
        ),
        market_id,
        outcome,
        side: side.into(),
        price: format_token_amount(price_raw),
        size: format_token_amount(created.amount),
        status: "open".into(),
    };

    tracing::info!(
        order_id = chain_order_id,
        market_id = %market_id,
        user = %created.creator,
        "indexed order"
    );

    store
        .insert_order(order, created.creator.to_string(), chain_order_id, created.amount)
        .await;
}
