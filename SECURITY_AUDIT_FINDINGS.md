
const db = getDatabaseClient();

return await db.begin(async (tx) => {
  const transactionRows = await tx.unsafe(
    `SELECT wallet_id, amount, transaction_status, metadata
     FROM public.transactions
     WHERE transaction_id = $1
     FOR UPDATE`,
    [transactionId],
  );

  const transaction = transactionRows[0] as
    | {
        wallet_id: string;
        amount: number | string;
        transaction_status: string;
        metadata: unknown;
      }
    | undefined;

  if (!transaction) {
    throw new Error(`Transaction ${transactionId} was not found`);
  }

  if (transaction.transaction_status === 'posted') {
    return {
      applied: false,
      reason: 'already_posted',
    };
  }

  const recoveredFromFailed =
    transaction.transaction_status === 'failed';

  const storedAmount = Number(transaction.amount);

  const {
    currencyMismatch,
    amountMismatch,
    amountUnverified,
  } = checkTopUpAmountValidity(storedAmount, expected);

  if (currencyMismatch || amountMismatch || amountUnverified) {
    await recordTopUpMismatch({
      client: tx,
      transactionId,
      provider,
      storedAmount,
      expected,
      amountUnverified,
    });

    return {
      applied: false,
      reason: amountUnverified
        ? 'amount_unverified'
        : 'amount_mismatch',
    };
  }

  await tx.unsafe(
    `UPDATE public.wallets
     SET balance = balance + $1,
         updated_at = timezone('utc', now())
     WHERE wallet_id = $2`,
    [transaction.amount, transaction.wallet_id],
  );

  const existingMetadata =
    transaction.metadata &&
    typeof transaction.metadata === 'object' &&
    !Array.isArray(transaction.metadata)
      ? (transaction.metadata as Record<string, unknown>)
      : {};

  const nextMetadata = {
    ...existingMetadata,
    provider,
    provider_payload: providerPayload,
    credited_via: `${provider}_webhook`,
    recovered_from_failed: recoveredFromFailed,
  };

  await tx.unsafe(
    `UPDATE public.transactions
     SET transaction_status = $1,
         reference_id = $2,
         metadata = $3::jsonb,
         updated_at = timezone('utc', now())
     WHERE transaction_id = $4`,
    [
      'posted',
      externalReference,
      JSON.stringify(nextMetadata),
      transactionId,
    ],
  );

  return {
    applied: true,
  };
});
