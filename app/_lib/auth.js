import NextAuth from "next-auth"; // NextAuth kütüphanesini içe aktarıyoruz.
import Google from "next-auth/providers/google"; // Google sağlayıcısını içe aktarıyoruz.
import { createGuest, getGuest } from "./data-service"; // createGuest ve getGuest fonksiyonlarını içe aktarıyoruz (bu fonksiyonlar veritabanıyla ilgili işlemleri yapıyor).

// NextAuth yapılandırma nesnesini oluşturuyoruz.
const authConfig = {
  providers: [
    // Google sağlayıcısını yapılandırıyoruz.
    Google({
      clientId: process.env.AUTH_GOOGLE_ID, // Google Client ID'yi çevresel değişkenlerden alıyoruz.
      clientSecret: process.env.AUTH_GOOGLE_SECRET, // Google Client Secret'ı çevresel değişkenlerden alıyoruz.
    }),
  ],
  callbacks: {
    // Bu callback, kullanıcının yetkili olup olmadığını kontrol eder.
    authorized({ auth, request }) {
      // auth?.user mevcutsa (yetkilendirme varsa), true döner, yoksa false döner.
      return !!auth?.user;
    },
    
    // signIn callback'i, kullanıcı giriş yaptığında çalışır.
    async signIn({ user, account, profile }) {
      try {
        // Kullanıcının mevcut olup olmadığını kontrol etmek için getGuest fonksiyonunu çağırıyoruz.
        const existingGuest = await getGuest(user.email);

        // Eğer kullanıcı veritabanında yoksa, yeni bir kullanıcı (guest) oluşturuyoruz.
        if (!existingGuest)
          await createGuest({ email: user.email, fullName: user.name });

        // Giriş başarılı olduğunda true döner.
        return true;
      } catch {
        // Herhangi bir hata olursa false döner ve giriş başarısız olur.
        return false;
      }
    },

    // session callback'i, oturum bilgilerini özelleştirmek için kullanılır.
    async session({ session, user }) {
      // Kullanıcının email adresine göre guest bilgilerini getiriyoruz.
      const guest = await getGuest(session.user.email);
      // Oturumdaki user objesine guestId'yi ekliyoruz.
      session.user.guestId = guest.id;
      // Güncellenmiş session nesnesini döndürüyoruz.
      return session;
    },
  },

  // Özelleştirilmiş oturum açma sayfası ayarları.
  pages: {
    signIn: "/login", // Eğer oturum açmak gerekirse "/login" sayfasına yönlendirilir.
  },
};

// NextAuth fonksiyonundan auth, signIn, signOut ve GET, POST handler'larını çıkartıyoruz.
export const {
  auth, // NextAuth ile authentication işlemlerini yönetmek için kullanılır.
  signIn, // Oturum açma işlemi.
  signOut, // Oturum kapatma işlemi.
  handlers: { GET, POST }, // GET ve POST handler'ları.
} = NextAuth(authConfig); // NextAuth yapılandırmasını kullanarak bu değerleri dışa aktarıyoruz.
