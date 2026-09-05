import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Card, Empty, ErrorState, Loader, Screen, Title, date, money } from '@/components/ui';
import { colors } from '@/constants/theme';
import { endpoints, errorMessage } from '@/lib/api';
import type { LedgerType } from '@/types';

const labels: Record<LedgerType, string> = { TOPUP:'Top up', PURCHASE_HOLD:'Dana ditahan', REFUND:'Refund', ESCROW_RELEASE:'Escrow dilepas', SELLER_PAYOUT:'Pendapatan seller' };
export default function WalletScreen(){
  const mobile = useWindowDimensions().width < 600;
  const balance=useQuery({queryKey:['balance'],queryFn:endpoints.balance});
  const ledger=useQuery({queryKey:['wallet-ledger'],queryFn:endpoints.walletLedger});
  return <Screen><Title eyebrow="AUDIT SALDO" subtitle="Setiap perubahan saldo dan escrow tercatat di sini.">Riwayat saldo</Title>
    <View style={styles.summary}><Card style={[styles.summaryCard,mobile&&styles.summaryCardMobile]}><Text style={styles.label}>Saldo tersedia</Text><Text style={styles.amount}>{money(balance.data?.balance)}</Text></Card><Card style={[styles.summaryCard,mobile&&styles.summaryCardMobile]}><Text style={styles.label}>Dana di escrow</Text><Text style={styles.amount}>{money(balance.data?.escrow)}</Text></Card></View>
    {ledger.isLoading ? <Loader/> : ledger.isError ? <ErrorState message={errorMessage(ledger.error)} retry={()=>ledger.refetch()}/> : !ledger.data?.length ? <Empty icon="wallet-outline" title="Belum ada aktivitas saldo" message="Top up dan transaksi akan tercatat otomatis."/> : <Card style={styles.list}>{ledger.data.map((item,index)=>{
      const balanceDelta=Number(item.balanceDelta||0); const escrowDelta=Number(item.escrowDelta||0);
      return <View key={item.id} style={[styles.row,mobile&&styles.rowMobile,index===ledger.data!.length-1&&styles.last]}><View style={styles.icon}><Ionicons name="swap-horizontal-outline" size={20} color={colors.primary}/></View><View style={styles.body}><Text style={styles.title}>{labels[item.type]}</Text><Text style={styles.copy}>{item.description||'Aktivitas saldo BMarket'} · {date(item.createdAt)}</Text><Text style={styles.after}>Saldo setelah transaksi: {money(item.balanceAfter)} · Escrow: {money(item.escrowAfter)}</Text></View><View style={[styles.delta,mobile&&styles.deltaMobile]}><Text style={[styles.deltaText,balanceDelta<0&&styles.negative]}>{balanceDelta===0?'—':`${balanceDelta>0?'+':''}${money(balanceDelta)}`}</Text>{escrowDelta!==0?<Text style={styles.escrowDelta}>Escrow {escrowDelta>0?'+':''}{money(escrowDelta)}</Text>:null}</View></View>})}</Card>}
  </Screen>;
}
const styles=StyleSheet.create({summary:{flexDirection:'row',flexWrap:'wrap',gap:14},summaryCard:{minWidth:240,flex:1},summaryCardMobile:{minWidth:0,flexBasis:'100%'},label:{fontFamily:'PoppinsMedium',fontSize:12,color:colors.muted},amount:{fontFamily:'PoppinsBold',fontSize:26,color:colors.text},list:{padding:0,gap:0,overflow:'hidden'},row:{padding:18,flexDirection:'row',alignItems:'center',gap:13,borderBottomWidth:1,borderBottomColor:colors.border},rowMobile:{padding:13,alignItems:'flex-start',flexWrap:'wrap'},last:{borderBottomWidth:0},icon:{width:42,height:42,borderRadius:12,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},body:{flex:1,gap:3},title:{fontFamily:'PoppinsSemiBold',fontSize:14,color:colors.text},copy:{fontFamily:'PoppinsRegular',fontSize:12,color:colors.muted},after:{fontFamily:'PoppinsRegular',fontSize:11,color:colors.textSoft},delta:{alignItems:'flex-end',gap:2},deltaMobile:{width:'100%',alignItems:'flex-start',paddingTop:8,borderTopWidth:1,borderTopColor:colors.border},deltaText:{fontFamily:'PoppinsBold',fontSize:13,color:colors.success},negative:{color:colors.danger},escrowDelta:{fontFamily:'PoppinsMedium',fontSize:11,color:colors.muted}});
