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
    // Yalnızca kullanıcının tutarı olan kayıtları getir:
    // - Alacaklı ise youwillreceive > 0
    // - Borçlu ise youwillgive > 0
    const { data, error } = await supabase
      .from('debts')
      .select(`
        *,
        creditor:profiles!debts_creditor_id_fkey (id, full_name, email, avatar_url),
        debtor:profiles!debts_debtor_id_fkey (id, full_name, email, avatar_url)
      `)
      .or(
        `and(creditor_id.eq.${userId},youwillreceive.gt.0),and(debtor_id.eq.${userId},youwillgive.gt.0)`
      )
      .order('created_at', { ascending: false });
    
    if (error) {
      return { data, error };
    }
    
    // Her kullanıcı için farklı veri döndür
    const processedData = (data || []).map(debt => {
      console.log('🔍 Processing debt:', { 
        id: debt.id, 
        creditor_id: debt.creditor_id, 
        debtor_id: debt.debtor_id, 
        userId, 
        youwillreceive: debt.youwillreceive, 
        youwillgive: debt.youwillgive 
      });
      
      const isCreditor = debt.creditor_id === userId;
      const isDebtor = debt.debtor_id === userId;
      
      if (isCreditor) {
        // Ben alacaklıyım - karşı taraf borçlu
        console.log('🔍 User is creditor, setting youwillreceive:', debt.youwillreceive);
        return {
          ...debt,
          youwillreceive: debt.youwillreceive || 0,
          youwillgive: 0,
          // Karşı tarafın bilgilerini göster
          other_party: debt.debtor
        };
      } else if (isDebtor) {
        // Ben borçluyum - karşı taraf alacaklı
        console.log('🔍 User is debtor, setting youwillgive:', debt.youwillgive);
        return {
          ...debt,
          youwillreceive: 0,
          youwillgive: debt.youwillgive || 0,
          // Karşı tarafın bilgilerini göster
          other_party: debt.creditor
        };
      } else {
        // Bu durum olmamalı ama güvenlik için
        console.log('🔍 User is neither creditor nor debtor, skipping');
        return null;
      }
      
    });
    
    // null değerleri filtrele
    const filteredData = processedData.filter(debt => debt !== null);
    console.log('🔍 Final processed data:', filteredData);
    return { data: filteredData, error: null };
  },

  async getDebtById(debtId: string) {
    const { data, error } = await supabase
      .from('debts')
      .select(`
        *,
        creditor:profiles!debts_creditor_id_fkey (id, full_name, email, avatar_url),
        debtor:profiles!debts_debtor_id_fkey (id, full_name, email, avatar_url)
      `)
      .eq('id', debtId)
      .single();
    
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
      console.log('NotificationService: Bildirim oluşturuluyor:', notification);
      
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
      
      if (error) {
        console.error('NotificationService: Supabase hatası:', error);
        return { data: null, error };
      }
      
      console.log('NotificationService: Bildirim başarıyla oluşturuldu:', data);
      return { data, error: null };
    } catch (error) {
      console.error('NotificationService: Genel hata:', error);
      return { data: null, error: error as any };
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

  async clearAllNotifications(userId: string) {
    try {
      console.log('🔍 clearAllNotifications called with userId:', userId);
      
      // Arkadaşlık istekleri hariç tüm bildirimleri sil
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .neq('type', 'friend_request');
      
      if (error) {
        console.error('❌ Supabase error in clearAllNotifications:', error);
      } else {
        console.log('✅ clearAllNotifications completed successfully');
      }
      
      return { error };
    } catch (error) {
      console.error('❌ Exception in clearAllNotifications:', error);
      console.warn('Could not clear notifications, table may not exist');
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
  // Kabul edilmiş arkadaşları getir
  async getFriends(userId: string) {
    try {
      console.log('🔍 getFriends called with userId:', userId);
      
      const { data, error } = await supabase
        .from('friends')
        .select(`
          *,
          profiles!friends_friend_id_fkey (
            id,
            full_name,
            email,
            phone,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      console.log('🔍 getFriends raw result:', { data, error });
      
      if (error) {
        console.error('❌ getFriends error:', error);
        return { data: [], error };
      }
      
      // Veriyi düzgün formata çevir
      const formattedData = (data || []).map((friend: any) => {
        const profile = friend.profiles;
        console.log('🔍 Processing friend:', { friend, profile });
        
        return {
          id: profile?.id || friend.friend_id,
          full_name: profile?.full_name || 'Kullanıcı',
          email: profile?.email || '',
          phone: profile?.phone || '-',
          avatar_url: profile?.avatar_url || null,
          // Orijinal friend kaydı için gerekli alanlar
          user_id: friend.user_id,
          friend_id: friend.friend_id,
          created_at: friend.created_at
        };
      });
      
      console.log('🔍 getFriends formatted result:', formattedData);
      
      return { data: formattedData, error: null };
    } catch (error) {
      console.error('❌ Error getting friends:', error);
      return { data: [], error: null };
    }
  },

  // Gelen arkadaşlık isteklerini getir
  async getIncomingFriendRequests(userId: string) {
    try {
      console.log('🔍 getIncomingFriendRequests called with userId:', userId);
      
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          *,
          profiles!friend_requests_from_user_id_fkey (
            id,
            full_name,
            email,
            phone,
            avatar_url
          )
        `)
        .eq('to_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      console.log('🔍 Incoming friend requests result:', { data, error });
      
      return { data: data || [], error };
    } catch (error) {
      console.error('Error getting incoming friend requests:', error);
      return { data: [], error: null };
    }
  },

  // Gönderilen arkadaşlık isteklerini getir
  async getOutgoingFriendRequests(userId: string) {
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          *,
          profiles!friend_requests_to_user_id_fkey (
            id,
            full_name,
            email,
            phone,
            avatar_url
          )
        `)
        .eq('from_user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      return { data: data || [], error };
    } catch (error) {
      console.error('Error getting outgoing friend requests:', error);
      return { data: [], error: null };
    }
  },

  // Tüm arkadaşlık isteklerini getir (gelen + giden)
  async getFriendRequests(userId: string) {
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          *,
          profiles!friend_requests_from_user_id_fkey (
            id,
            full_name,
            email,
            phone,
            avatar_url
          )
        `)
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      
      return { data: data || [], error };
    } catch (error) {
      console.error('Error getting friend requests:', error);
      return { data: [], error: null };
    }
  },

  // Arkadaşlık isteği gönder
  async sendFriendRequest(fromUserId: string, toUserId: string) {
    console.log('🚀 sendFriendRequest called with:', { fromUserId, toUserId });
    
    try {
      // Kendi kendine istek gönderilemez
      if (fromUserId === toUserId) {
        console.log('❌ Cannot send friend request to self');
        return { data: null, error: { message: 'Kendi kendinize arkadaşlık isteği gönderemezsiniz' } };
      }

      console.log('🔍 Checking existing friendships...');
      // Zaten arkadaş mı kontrol et
      const { data: existingFriendship, error: checkError } = await supabase
        .from('friends')
        .select('*')
        .or(`and(user_id.eq.${fromUserId},friend_id.eq.${toUserId}),and(user_id.eq.${toUserId},friend_id.eq.${fromUserId})`)
        .single();

      console.log('🔍 Existing friendship check result:', { existingFriendship, checkError });

      if (existingFriendship && !checkError) {
        console.log('❌ Already friends');
        return { data: null, error: { message: 'Bu kullanıcı zaten arkadaşınız' } };
      }

      console.log('🔍 Checking existing friend requests...');
      // Zaten istek gönderilmiş mi kontrol et
      const { data: existingRequest, error: requestCheckError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('from_user_id', fromUserId)
        .eq('to_user_id', toUserId)
        .eq('status', 'pending')
        .single();

      console.log('🔍 Existing request check result:', { existingRequest, requestCheckError });

      if (existingRequest && !requestCheckError) {
        console.log('❌ Friend request already pending');
        return { data: null, error: { message: 'Bu kullanıcıya zaten arkadaşlık isteği gönderdiniz' } };
      }

      console.log('📝 Creating friend request...');
      // Arkadaşlık isteği oluştur
      const { data, error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: fromUserId,
          to_user_id: toUserId,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      console.log('📝 Friend request creation result:', { data, error });

      if (error) {
        console.log('❌ Friend request creation failed:', error);
        return { data: null, error };
      }

      console.log('✅ Friend request created successfully');

      // Bildirim gönder
      try {
        console.log('📬 Sending notification...');
        await notificationService.createNotification({
          user_id: toUserId,
          title: 'Yeni Arkadaş İsteği',
          message: 'Size bir arkadaş isteği gönderildi',
          type: 'friend_request',
          data: { 
            from_user_id: fromUserId,
            friendship_id: data.id
          }
        });
        console.log('✅ Notification sent successfully');
      } catch (notificationError) {
        console.warn('⚠️ Could not send notification:', notificationError);
        // Bildirim gönderilemese bile arkadaşlık isteği oluşturuldu
      }

      return { data, error: null };
    } catch (error) {
      console.error('❌ Error sending friend request:', error);
      return { data: null, error: { message: 'Arkadaşlık isteği gönderilirken hata oluştu' } };
    }
  },

  // Arkadaşlık isteğini kabul et
  async acceptFriendRequest(friendshipId: string, userId: string) {
    try {
      // İsteği kabul et
      const { data: friendship, error: updateError } = await supabase
        .from('friend_requests')
        .update({ 
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', friendshipId)
        .eq('to_user_id', userId)
        .eq('status', 'pending')
        .select()
        .single();

      if (updateError || !friendship) {
        return { data: null, error: { message: 'Arkadaşlık isteği bulunamadı veya zaten işlenmiş' } };
      }

      // Önce mevcut arkadaşlık kayıtlarını kontrol et
      const { data: existingFriendships } = await supabase
        .from('friends')
        .select('user_id, friend_id')
        .or(`and(user_id.eq.${friendship.from_user_id},friend_id.eq.${friendship.to_user_id}),and(user_id.eq.${friendship.to_user_id},friend_id.eq.${friendship.from_user_id})`);

      console.log('🔍 Existing friendships:', existingFriendships);

      // Eksik olan kayıtları oluştur
      const friendshipData = [];
      
      // İlk yön: from_user_id -> to_user_id
      const existsFirst = existingFriendships?.some(f => 
        f.user_id === friendship.from_user_id && f.friend_id === friendship.to_user_id
      );
      if (!existsFirst) {
        friendshipData.push({
          user_id: friendship.from_user_id,
          friend_id: friendship.to_user_id,
          created_at: new Date().toISOString(),
        });
      }

      // İkinci yön: to_user_id -> from_user_id
      const existsSecond = existingFriendships?.some(f => 
        f.user_id === friendship.to_user_id && f.friend_id === friendship.from_user_id
      );
      if (!existsSecond) {
        friendshipData.push({
          user_id: friendship.to_user_id,
          friend_id: friendship.from_user_id,
          created_at: new Date().toISOString(),
        });
      }

      console.log('🔍 Friendship data to insert:', friendshipData);

      // Sadece eksik olan kayıtları ekle
      if (friendshipData.length > 0) {
        const { error: mutualError } = await supabase
          .from('friends')
          .insert(friendshipData);

        if (mutualError) {
          console.error('Error creating mutual friendship:', mutualError);
          return { data: null, error: { message: 'Arkadaşlık kaydı oluşturulurken hata oluştu' } };
        }
      } else {
        console.log('✅ All friendship records already exist, skipping insert');
      }

      // Bildirimi okundu işaretle
      try {
        await notificationService.markAsRead(friendshipId);
      } catch (notificationError) {
        console.warn('Could not mark notification as read:', notificationError);
      }

      return { data: friendship, error: null };
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return { data: null, error: { message: 'Arkadaşlık isteği kabul edilirken hata oluştu' } };
    }
  },

  // Arkadaşlık isteğini reddet
  async rejectFriendRequest(friendshipId: string, userId: string) {
    try {
      const { data, error } = await supabase
        .from('friend_requests')
        .update({ 
          status: 'declined',
          responded_at: new Date().toISOString()
        })
        .eq('id', friendshipId)
        .eq('to_user_id', userId)
        .eq('status', 'pending')
        .select()
        .single();

      if (error || !data) {
        return { data: null, error: { message: 'Arkadaşlık isteği bulunamadı veya zaten işlenmiş' } };
      }

      // Bildirimi okundu işaretle
      try {
        await notificationService.markAsRead(friendshipId);
      } catch (notificationError) {
        console.warn('Could not mark notification as read:', notificationError);
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      return { data: null, error: { message: 'Arkadaşlık isteği reddedilirken hata oluştu' } };
    }
  },

  // Arkadaşlık isteğine yanıt ver (kabul/reddet)
  async respondFriendRequest(friendshipId: string, status: 'accepted' | 'declined') {
    try {
      console.log('🔍 respondFriendRequest called with:', { friendshipId, status });
      
      // Önce isteği bul
      const { data: request, error: fetchError } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('id', friendshipId)
        .eq('status', 'pending')
        .single();

      console.log('🔍 Friend request fetch result:', { request, fetchError });

      if (fetchError || !request) {
        console.error('❌ Friend request not found or already processed:', { fetchError, request });
        return { data: null, error: { message: 'Arkadaşlık isteği bulunamadı veya zaten işlenmiş' } };
      }

      // İsteği güncelle
      const { data: updatedRequest, error: updateError } = await supabase
        .from('friend_requests')
        .update({ 
          status: status === 'accepted' ? 'accepted' : 'declined',
          responded_at: new Date().toISOString()
        })
        .eq('id', friendshipId)
        .eq('status', 'pending')
        .select()
        .single();

      if (updateError || !updatedRequest) {
        return { data: null, error: { message: 'Arkadaşlık isteği güncellenirken hata oluştu' } };
      }

      // Eğer kabul edildiyse, friends tablosuna ekle
      if (status === 'accepted') {
        // Önce mevcut arkadaşlık kayıtlarını kontrol et
        const { data: existingFriendships } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .or(`and(user_id.eq.${request.from_user_id},friend_id.eq.${request.to_user_id}),and(user_id.eq.${request.to_user_id},friend_id.eq.${request.from_user_id})`);

        console.log('🔍 Existing friendships:', existingFriendships);

        // Eksik olan kayıtları oluştur
        const friendshipData = [];
        
        // İlk yön: from_user_id -> to_user_id
        const existsFirst = existingFriendships?.some(f => 
          f.user_id === request.from_user_id && f.friend_id === request.to_user_id
        );
        if (!existsFirst) {
          friendshipData.push({
            user_id: request.from_user_id,
            friend_id: request.to_user_id,
            created_at: new Date().toISOString(),
          });
        }

        // İkinci yön: to_user_id -> from_user_id
        const existsSecond = existingFriendships?.some(f => 
          f.user_id === request.to_user_id && f.friend_id === request.from_user_id
        );
        if (!existsSecond) {
          friendshipData.push({
            user_id: request.to_user_id,
            friend_id: request.from_user_id,
            created_at: new Date().toISOString(),
          });
        }

        console.log('🔍 Friendship data to insert:', friendshipData);

        // Sadece eksik olan kayıtları ekle
        if (friendshipData.length > 0) {
          const { error: mutualError } = await supabase
            .from('friends')
            .insert(friendshipData);

          if (mutualError) {
            console.error('Error creating mutual friendship:', mutualError);
            return { data: null, error: { message: 'Arkadaşlık kaydı oluşturulurken hata oluştu' } };
          }
        } else {
          console.log('✅ All friendship records already exist, skipping insert');
        }
      }

      // Bildirimi okundu işaretle
      try {
        await notificationService.markAsRead(friendshipId);
      } catch (notificationError) {
        console.warn('Could not mark notification as read:', notificationError);
      }

      return { data: updatedRequest, error: null };
    } catch (error) {
      console.error('Error responding to friend request:', error);
      return { data: null, error: { message: 'Arkadaşlık isteğine yanıt verilirken hata oluştu' } };
    }
  },

  // Arkadaşlığı kaldır
  async removeFriend(userId: string, friendId: string) {
    try {
      // Her iki yöndeki arkadaşlık kayıtlarını sil
      const { error: error1 } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', userId)
        .eq('friend_id', friendId);

      const { error: error2 } = await supabase
        .from('friends')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_id', userId);

      if (error1 || error2) {
        return { error: { message: 'Arkadaşlık kaldırılırken hata oluştu' } };
      }

      return { error: null };
    } catch (error) {
      console.error('Error removing friend:', error);
      return { error: { message: 'Arkadaşlık kaldırılırken hata oluştu' } };
    }
  },

  // Kullanıcı arama (tüm kullanıcılar)
  async searchUsers(userId: string, query: string) {
    try {
      console.log('🔍 searchUsers called with:', { userId, query });
      
      // Tüm kullanıcıları ara (kendisi hariç)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url')
        .neq('id', userId)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
        .limit(20);

      console.log('🔍 Search results:', { data, error });

      if (error) {
        console.error('❌ Search error:', error);
        return { data: [], error };
      }

      // Mevcut arkadaşlıkları ve istekleri al
      const { data: friendships } = await supabase
        .from('friends')
        .select('friend_id, user_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      const { data: outgoingRequests } = await supabase
        .from('friend_requests')
        .select('to_user_id')
        .eq('from_user_id', userId)
        .eq('status', 'pending');

      const friendIds = new Set();
      friendships?.forEach(f => {
        if (f.user_id === userId) friendIds.add(f.friend_id);
        if (f.friend_id === userId) friendIds.add(f.user_id);
      });

      const pendingIds = new Set();
      outgoingRequests?.forEach(r => pendingIds.add(r.to_user_id));

      // Sonuçlara arkadaşlık durumunu ekle
      const results = (data || []).map(profile => ({
        ...profile,
        isFriend: friendIds.has(profile.id),
        isPending: pendingIds.has(profile.id)
      }));

      console.log('🔍 Processed results:', results);

      return { data: results, error: null };
    } catch (error) {
      console.error('Error searching users:', error);
      return { data: [], error: null };
    }
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