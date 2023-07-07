import { create, getOptional } from '@kodadot1/metasquid/entity'
import md5 from 'md5'
import { CollectionEntity as CE, NFTEntity as NE, TokenEntity as TE } from '../../model'
import { warn } from '../utils/logger'
import { Context } from '../utils/types'

const OPERATION = 'TokenEntity' as any

export async function handleTokenEntity(context: Context, collection: CE, nft: NE): Promise<TE | undefined> {
  const nftMedia = nft.image || nft.media
  if (!nftMedia || nftMedia === '') {
    warn(OPERATION, `MISSING NFT MEDIA ${nft.id}`)
    return
  }

  const tokenId = md5(`${collection.id}${nftMedia}`)
  let token = await getOptional<TE>(context.store, TE, tokenId)

  if (!token) {
    // const tokenName = typeof nft.name === 'string' ? nft.name?.replace(/([#_]\d+$)/g, '') : ''

    token = create(TE, tokenId, {
      createdAt: nft.createdAt,
      collection,
      name: nft.name,
      count: 1,
      hash: md5(tokenId),
      image: nft.image,
      media: nft.media,
      blockNumber: nft.blockNumber,
      updatedAt: nft.updatedAt,
      id: tokenId,
    })
  } else {
    token.count += 1
  }

  token.updatedAt = nft.updatedAt
  token.blockNumber = nft.blockNumber

  await context.store.save(token)

  return token
}
