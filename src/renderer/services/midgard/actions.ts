import * as RD from '@devexperts/remote-data-ts'
import { Action, GetActions200Response, MidgardApi } from '@xchainjs/xchain-midgard'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as Rx from 'rxjs'
import { from } from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { liveData } from '../../helpers/rx/liveData'
import { ErrorId } from '../wallet/types'
import { getRequestType, mapAction } from './action.utils'
import { LoadActionsParams, ActionsPageLD, MidgardUrlLD } from './types'

export const createActionsService = (
  midgardUrl$: MidgardUrlLD,
  getMidgardDefaultApi: (basePath: string) => MidgardApi
) => {
  const midgardDefaultApi$ = FP.pipe(midgardUrl$, liveData.map(getMidgardDefaultApi), RxOp.shareReplay(1))

  const getActions$ = ({ itemsPerPage, page, type, addresses = [], ...params }: LoadActionsParams): ActionsPageLD =>
    FP.pipe(
      midgardDefaultApi$,
      liveData.mapLeft(() => ({
        errorId: ErrorId.GET_ACTIONS,
        msg: 'API is not available'
      })),
      liveData.chain((api) =>
        FP.pipe(
          from(
            api.getActions(
              addresses.join(','), // address parameter as a concatenated string
              params.txid, // txid, assuming not used in this context
              params.asset, // asset from the rest parameters if available
              getRequestType(type), // type after processing
              type,
              undefined, // affiliate, assuming not used in this context
              itemsPerPage, // limit parameter
              itemsPerPage * page // offset parameter
            )
          ),
          RxOp.catchError(
            (): Rx.Observable<GetActions200Response> =>
              Rx.of({ actions: [], count: '0', meta: { nextPageToken: '', prevPageToken: '' } })
          ),
          RxOp.switchMap((response) => Rx.of(RD.success(response))),
          liveData.map((response) => {
            // Check if response is of AxiosResponse type and extract the data property if so
            const responseData = 'data' in response ? response.data : response

            // Now, responseData is guaranteed to be of type GetActions200Response
            const { actions, count } = responseData

            return {
              actions: FP.pipe(
                actions as Action[], // Ensure actions is treated as an array of Action; adjust the casting as necessary based on your types
                A.map(mapAction) // Assuming mapAction correctly transforms each action
              ),
              total: parseInt(count || '0', 10) // Default to '0' if count is not provided
            }
          }),
          liveData.mapLeft(() => ({
            errorId: ErrorId.GET_ACTIONS,
            msg: 'Error while getting a history'
          })),
          RxOp.startWith(RD.pending),
          RxOp.catchError((e) =>
            Rx.of(
              RD.failure({
                errorId: ErrorId.GET_ACTIONS,
                msg: e
              })
            )
          )
        )
      )
    )

  return {
    getActions$
  }
}
