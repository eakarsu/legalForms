import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card} from 'react-native-paper';
import {colors, spacing} from '../../utils/theme';

const RetainerTrustScreen: React.FC = () => {
  const [data, setData] = useState<any>({summary: {}, retainers: []});
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch('/api/retainer-trust-reconciliation').then(res => res.json()).then(setData).catch(() => {});
  }, []);

  const reconcile = async (id: string) => {
    const res = await fetch('/api/retainer-trust-reconciliation/reconcile', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id}),
    });
    setResult(await res.json());
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Retainer Trust Reconciliation</Text>
        {Object.entries(data.summary).map(([key, value]) => <Card style={styles.card} key={key}><Card.Content><Text>{key}: {String(value)}</Text></Card.Content></Card>)}
        {data.retainers.map((item: any) => (
          <Card style={styles.card} key={item.id}>
            <Card.Content>
              <Text style={styles.heading}>{item.client}</Text>
              <Text>{item.id} - trust balance ${item.trustBalance} - {item.status}</Text>
              <TouchableOpacity style={styles.button} onPress={() => reconcile(item.id)}><Text style={styles.buttonText}>Reconcile</Text></TouchableOpacity>
            </Card.Content>
          </Card>
        ))}
        {result && <Text>{JSON.stringify(result)}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.md},
  title: {fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.md},
  heading: {fontSize: 16, fontWeight: '700', color: colors.text},
  card: {marginBottom: spacing.md},
  button: {marginTop: spacing.sm, backgroundColor: colors.primary, padding: spacing.sm, borderRadius: 8},
  buttonText: {color: colors.textLight, textAlign: 'center', fontWeight: '700'},
});

export default RetainerTrustScreen;
