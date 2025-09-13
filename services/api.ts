// @ts-nocheck
import { supabase } from '../lib/supabase';

// Type helpers - geçici olarak any kullanıyoruz TypeScript sorunları için
type Inserts<T> = any;
type Updates<T> = any;

// Profile işlemleri
export const profileService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    return { data, error };
  },

  async updateProfile(userId: string, updates: Updates<'profiles'>) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', userId)
      .select()
      .single();
    
    return { data, error };
  },

  async searchProfiles(query: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`full_name.ilike.%${query}%, email.ilike.%${query}%, phone.ilike.%${query}%`)
      .limit(20);
    
    return { data, error };
  },

  async updateTrustScore(userId: string, newScore: number) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        trust_score: Math.max(0, Math.min(5, newScore)),
        updated_at: new Date().toISOString() 
      } as any)
      .eq('id', userId)
      .select()
      .single();
    
    return { data, error };
  },
};

// Transaction işlemleri (eski debts yerine)
export const debtService = {
  async createDebt(payload: { 
    creditor_id: string; 
    debtor_id: string; 
    youwillreceive?: number; 
    youwillgive?: number; 
    description?: string | null; 
    group_id?: string | null; 
    pay_date?: string | null; 
  }) {
    const { data, error } = await supabase
      .from('debts')
      .insert({
        creditor_id: payload.creditor_id,
        debtor_id: payload.debtor_id,
        youwillreceive: payload.youwillreceive ?? 0,
        youwillgive: payload.youwillgive ?? 0,
        description: payload.description ?? null,
        group_id: payload.group_id ?? null,
        is_settled: false,
        pay_date: payload.pay_date ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .select()
      .single();
    return { data, error };
  },

  async getDebts(userId: string) {
    const { data, error } = await supabase
      .from('debts')
      .select(`
        *,
        creditor:profiles!debts_creditor_id_fkey (id, full_name, email, avatar_url),
        debtor:profiles!debts_debtor_id_fkey (id, full_name, email, avatar_url)
      `)
      .or(`creditor_id.eq.${userId},debtor_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async settleDebt(debtId: string) {
    const { data, error } = await supabase
      .from('debts')
      .update({ is_settled: true, updated_at: new Date().toISOString() } as any)
      .eq('id', debtId)
      .select()
      .single();
    return { data, error };
  },

  async updateDebt(debtId: string, updates: { 
    youwillreceive?: number; 
    youwillgive?: number; 
    description?: string | null; 
    pay_date?: string | null 
  }) {
    const { data, error } = await supabase
      .from('debts')
      .update({
        ...(updates.youwillreceive !== undefined ? { youwillreceive: updates.youwillreceive } : {}),
        ...(updates.youwillgive !== undefined ? { youwillgive: updates.youwillgive } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', debtId)
      .select()
      .single();
    return { data, error };
  },

  async deleteDebt(debtId: string) {
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', debtId);
    return { error };
  },
};

// Grup işlemleri
export const groupService = {
  async createGroup(group: Inserts<'groups'>) {
    // Önce grubu oluştur
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert({
        name: group.name,
        description: group.description,
        created_by: group.created_by,
        total_amount: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .select()
      .single();
    
    if (groupError || !groupData) {
      return { data: null, error: groupError };
    }

    // Grup oluşturucuyu otomatik olarak grup üyesi yap
    const { error: memberError } = await supabase
      .from('group_members')
      .upsert({
        group_id: groupData.id,
        user_id: group.created_by,
        amount_owed: 0,
        is_paid: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any, {
        onConflict: 'group_id,user_id'
      });

    if (memberError) {
      console.error('Error adding creator as group member:', memberError);
    }
    
    return { data: groupData, error: null };
  },

  async getGroups(userId: string) {
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        group_members (
          id,
          user_id,
          amount_owed,
          is_paid,
          profiles (
            full_name,
            email,
            avatar_url
          )
        ),
        profiles!groups_created_by_fkey (
          full_name,
          email,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      return { data: [], error };
    }
    
    // Client-side filtering
    const filteredGroups = data?.filter(group => 
      group.created_by === userId || 
      group.group_members?.some((member: any) => member.user_id === userId)
    ) || [];
    
    return { data: filteredGroups, error: null };
  },

  async getGroup(groupId: string) {
    const { data, error } = await supabase
      .from('groups')
      .select(`
        *,
        group_members (
          id,
          user_id,
          amount_owed,
          is_paid,
          profiles (
            full_name,
            email,
            phone,
            avatar_url,
            trust_score
          )
        ),
        profiles!groups_created_by_fkey (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('id', groupId)
      .single();
    
    return { data, error };
  },

  async updateGroup(groupId: string, updates: Updates<'groups'>) {
    const { data, error } = await supabase
      .from('groups')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', groupId)
      .select()
      .single();
    
    return { data, error };
  },

  async deleteGroup(groupId: string) {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);
    
    return { error };
  },

  async getGroupSummary(groupId: string) {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        *,
        profiles (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('group_id', groupId);
    
    return { data, error };
  },
};

// Grup üyesi işlemleri
export const groupMemberService = {
  async addMembers(members: Inserts<'group_members'>[]) {
    const { data, error } = await supabase
      .from('group_members')
      .upsert(
        members.map(member => ({
          user_id: member.user_id,
          group_id: member.group_id,
          amount_owed: member.amount_owed || 0,
          is_paid: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })) as any,
        {
          onConflict: 'group_id,user_id'
        }
      )
      .select();
    
    return { data, error };
  },

  async updateMemberAmount(memberId: string, amountOwed: number, isPaid: boolean) {
    const { data, error } = await supabase
      .from('group_members')
      .update({ 
        amount_owed: amountOwed,
        is_paid: isPaid,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', memberId)
      .select()
      .single();
    
    return { data, error };
  },

  async removeMember(memberId: string) {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', memberId);
    
    return { error };
  },

  async getGroupMembers(groupId: string) {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        *,
        profiles (
          full_name,
          email,
          phone,
          avatar_url,
          trust_score
        )
      `)
      .eq('group_id', groupId);
    
    return { data, error };
  },

  async leaveGroup(groupId: string, userId: string) {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);
    
    return { error };
  },
};

// Grup davet işlemleri
export const invitationService = {
  async createInvitation(invitation: Inserts<'group_invitations'>) {
    const { data, error } = await supabase
      .from('group_invitations')
      .insert({
        group_id: invitation.group_id,
        invited_by: invitation.invited_by,
        invited_user_email: invitation.invited_user_email,
        expires_at: invitation.expires_at,
        status: 'pending',
        created_at: new Date().toISOString(),
      } as any)
      .select()
      .single();
    
    return { data, error };
  },

  async getInvitations(userEmail: string) {
    const { data, error } = await supabase
      .from('group_invitations')
      .select(`
        *,
        groups (
          name,
          description
        ),
        profiles!group_invitations_invited_by_fkey (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('invited_user_email', userEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());
    
    return { data, error };
  },

  async respondToInvitation(invitationId: string, status: 'accepted' | 'declined') {
    const { data, error } = await supabase
      .from('group_invitations')
      .update({ status } as any)
      .eq('id', invitationId)
      .select()
      .single();
    
    return { data, error };
  },
};

// Bildirim işlemleri
export const notificationService = {
  async createNotification(notification: Inserts<'notifications'>) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: notification.user_id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          data: notification.data || null,
          read: false,
          created_at: new Date().toISOString(),
        } as any)
        .select()
        .single();
      
      return { data, error };
    } catch (error) {
      console.warn('Could not create notification, table may not exist');
      return { data: null, error: null };
    }
  },

  async getNotifications(userId: string) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      return { data: data || [], error };
    } catch (error) {
      console.warn('Could not get notifications, table may not exist');
      return { data: [], error: null };
    }
  },

  async markAsRead(notificationId: string) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true } as any)
        .eq('id', notificationId)
        .select()
        .single();
      
      return { data, error };
    } catch (error) {
      console.warn('Could not mark notification as read, table may not exist');
      return { data: null, error: null };
    }
  },

  async markAllAsRead(userId: string) {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true } as any)
        .eq('user_id', userId)
        .eq('read', false)
        .select();
      
      return { data: data || [], error };
    } catch (error) {
      console.warn('Could not mark all notifications as read, table may not exist');
      return { data: [], error: null };
    }
  },

  async deleteNotification(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      
      return { error };
    } catch (error) {
      console.warn('Could not delete notification, table may not exist');
      return { error: null };
    }
  },
};

// Transaction işlemleri
export const transactionService = {
  async createTransaction(transaction: Inserts<'transactions'>) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        from_user_id: transaction.from_user_id,
        to_user_id: transaction.to_user_id,
        amount: transaction.amount,
        description: transaction.description,
        type: transaction.type,
        status: transaction.status || 'pending',
        group_id: transaction.group_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .select()
      .single();
    
    return { data, error };
  },

  async getTransactions(userId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        from_user:profiles!transactions_from_user_id_fkey (id, full_name, email, avatar_url),
        to_user:profiles!transactions_to_user_id_fkey (id, full_name, email, avatar_url)
      `)
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    
    return { data, error };
  },

  async updateTransactionStatus(transactionId: string, status: 'pending' | 'completed' | 'cancelled') {
    const { data, error } = await supabase
      .from('transactions')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      } as any)
      .eq('id', transactionId)
      .select()
      .single();
    
    return { data, error };
  },
};

// Friend işlemleri
export const friendService = {
  async getFriends(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', userId)
        .limit(50);
      
      return { data, error };
    } catch (error) {
      console.error('Error getting friends:', error);
      return { data: [], error: null };
    }
  },

  async getFriendRequests(userId: string) {
    try {
      // notifications tablosu yoksa boş array döndür
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'friend_request')
        .eq('read', false)
        .order('created_at', { ascending: false });
      
      return { data: data || [], error };
    } catch (error) {
      // Tablo bulunamazsa boş array döndür
      console.warn('Notifications table not found, returning empty friend requests');
      return { data: [], error: null };
    }
  },

  async sendFriendRequest(fromUserId: string, toUserId: string) {
    try {
      // notifications tablosu yoksa sadece başarılı response döndür
      const { data, error } = await notificationService.createNotification({
        user_id: toUserId,
        title: 'Yeni Arkadaş İsteği',
        message: 'Size bir arkadaş isteği gönderildi',
        type: 'friend_request',
        data: { from_user_id: fromUserId }
      });
      
      return { data, error };
    } catch (error) {
      console.warn('Could not send friend request notification, table may not exist');
      return { data: null, error: null };
    }
  },

  async respondFriendRequest(requestId: string, response: 'accepted' | 'declined') {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true } as any)
        .eq('id', requestId)
        .select()
        .single();
      
      return { data, error };
    } catch (error) {
      console.warn('Could not respond to friend request, notifications table may not exist');
      return { data: null, error: null };
    }
  },

  async removeFriend(userId: string, friendId: string) {
    // Bu örnekte sadece başarılı response döndürüyoruz
    // Gerçek implementasyonda friend relationship tablosu olabilir
    return { error: null };
  },
};

// Utility işlemleri
export const utilService = {
  async searchUsers(query: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, avatar_url')
      .or(`full_name.ilike.%${query}%, email.ilike.%${query}%, phone.ilike.%${query}%`)
      .limit(20);
    
    return { data, error };
  },

  async sendWhatsAppInvite(phone: string, senderName: string, amount: number, description: string) {
    const message = `Merhaba! ${senderName} size ${amount}₺ tutarında bir borç kaydı oluşturdu. Açıklama: ${description}. Borccu uygulamasını indirerek borçlarınızı kolayca takip edebilirsiniz.`;
    const encodedMessage = encodeURIComponent(message);
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    
    return { whatsappUrl };
  },

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2
    }).format(amount);
  },

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  },

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },
};