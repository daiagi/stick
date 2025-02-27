import { warn } from 'node:console'
import { create, getOptional } from '@kodadot1/metasquid/entity'
import md5 from 'md5'
import { CollectionEntity as CE, NFTEntity as NE } from '../../model'
import { createEvent } from '../shared/event'
import { handleMetadata } from '../shared/metadata'
import { unwrap } from '../utils/extract'
import { debug, pending, success } from '../utils/logger'
import { Action, Context, createTokenId } from '../utils/types'
import { versionOf , calculateCollectionOwnerCountAndDistribution } from '../utils/helper'
import { handleTokenEntity } from '../shared/handleTokenEntity'
import { getCreateTokenEvent } from './getters'

const OPERATION = Action.MINT

export async function handleTokenCreate(context: Context): Promise<void> {
  pending(OPERATION, context.block.height.toString())
  const event = unwrap(context, getCreateTokenEvent)
  debug(OPERATION, event)
  const id = createTokenId(event.collectionId, event.sn)
  const collection = await getOptional<CE>(context.store, CE, event.collectionId)

  if (!collection) {
    warn(OPERATION, `collection ${event.collectionId} not found`)
    return
  }

  const final = create(NE, id, {})
  // plsBe(real, collection);
  // plsBe(remintable, final);

  final.id = id
  final.hash = md5(id)
  final.issuer = event.caller
  final.currentOwner = event.owner
  final.blockNumber = BigInt(event.blockNumber)
  final.collection = collection
  final.sn = event.sn
  final.metadata = event.metadata || collection.metadata
  final.price = BigInt(0)
  final.burned = false
  final.createdAt = event.timestamp
  final.updatedAt = event.timestamp
  final.lewd = false
  final.version = versionOf(context)

  collection.updatedAt = event.timestamp
  collection.nftCount += 1
  collection.supply += 1
  const { ownerCount, distribution } = await calculateCollectionOwnerCountAndDistribution(
    context.store,
    collection.id,
    final.currentOwner
  )
  collection.ownerCount = ownerCount
  collection.distribution = distribution

  if (final.metadata) {
    const metadata = await handleMetadata(final.metadata, context.store)
    final.meta = metadata
    final.name = metadata?.name
    final.image = metadata?.image
    final.media = metadata?.animationUrl
  }

  const token = await handleTokenEntity(context, collection, final)
  if (token) {
    final.token = token
  }

  success(OPERATION, `${final.id}`)
  await context.store.save(final)
  await context.store.save(collection)
  await createEvent(final, OPERATION, event, '', context.store)

  if (final.issuer !== final.currentOwner) {
    await createEvent(final, Action.SEND, event, final.currentOwner, context.store, final.issuer)
  }
}
