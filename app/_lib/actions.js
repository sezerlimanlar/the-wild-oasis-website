"use server"; // Bu dosyanın sunucu tarafında çalıştığını belirtir.

import { auth, signIn, signOut } from "./auth"; // auth, signIn ve signOut işlemleri için gerekli fonksiyonları içe aktarıyoruz.
import { getBookings } from "./data-service"; // Rezervasyonları getiren fonksiyonu içe aktarıyoruz.
import { supabase } from "./supabase"; // Supabase ile etkileşim için supabase örneğini içe aktarıyoruz.
import { revalidatePath } from "next/cache"; // Sayfa önbelleğini yeniden doğrulamak için gerekli fonksiyonu içe aktarıyoruz.
import { redirect } from "next/navigation"; // Yönlendirme işlemi için gerekli fonksiyonu içe aktarıyoruz.

export async function updateGuest(formData) {
  // Misafir bilgilerini güncellemek için kullanılan fonksiyon.
  const session = await auth(); // Oturum bilgisini alıyoruz.
  if (!session) throw new Error("You must be logged in"); // Eğer oturum yoksa hata fırlatıyoruz.

  const nationalID = formData.get("nationalID"); // Formdan alınan nationalID'yi alıyoruz.
  const [nationality, countryFlag] = formData.get("nationality").split("%"); // nationality ve countryFlag'ı ayırıyoruz.

  // NationalID'nin geçerli olup olmadığını kontrol eden bir regex.
  if (!/^[a-zA-Z0-9]{6,12}$/.test(nationalID))
    throw new Error("Please provide a valid national ID");

  // Güncellenecek verileri hazırlıyoruz.
  const updateData = { nationality, countryFlag, nationalID };

  // Supabase ile "guests" tablosunda güncelleme yapıyoruz.
  const { data, error } = await supabase
    .from("guests")
    .update(updateData)
    .eq("id", session.user.guestId); // Kullanıcının guestId'sine göre güncelleme yapıyoruz.
  console.log(session.user); // Kullanıcı bilgisini logluyoruz.

  if (error) throw new Error("Guest could not be updated"); // Eğer hata varsa, hata fırlatıyoruz.

  revalidatePath("/account/profile"); // sayfanın eski verileri göstermemesi ve yeni güncel verileri göstermesi için bu fonksiyon çağrılıyor.
}

export async function createBooking(bookingData, formData) {
  // Yeni bir rezervasyon oluşturma fonksiyonu.
  const session = await auth(); // Oturum bilgisini alıyoruz.
  if (!session) throw new Error("You must be logged in"); // Eğer oturum yoksa hata fırlatıyoruz.

  // Rezervasyon için gerekli olan yeni verileri hazırlıyoruz.
  const newBooking = {
    ...bookingData, // Mevcut rezervasyon verilerini alıyoruz.
    guestId: session.user.guestId, // Oturumdaki guestId'yi ekliyoruz.
    numGuests: Number(formData.get("numGuests")), // Misafir sayısını formdan alıyoruz.
    observations: formData.get("observations").slice(0, 1000), // Gözlemleri formdan alıyoruz, 1000 karakter ile sınırlıyoruz.
    extrasPrice: 0, // Ekstra ücret başlangıçta 0.
    totalPrice: bookingData.cabinPrice, // Toplam ücret kabin fiyatına eşit.
    isPaid: false, // Ödeme yapılmamış olarak başlıyor.
    hasBreakfast: false, // Kahvaltı seçilmemiş olarak başlıyor.
    status: "unconfirmed", // Başlangıç durumu "onaylanmamış".
  };

  // Supabase ile "bookings" tablosuna yeni rezervasyon ekliyoruz.
  const { error } = await supabase.from("bookings").insert([newBooking]);

  if (error) throw new Error("Booking could not be created"); // Eğer hata varsa hata fırlatıyoruz.

  revalidatePath(`/cabins/${bookingData.cabinId}`); // sayfanın eski verileri göstermemesi ve yeni güncel verileri göstermesi için bu fonksiyon çağrılıyor.

  redirect("/cabins/thankyou"); // Rezervasyon sonrası teşekkür sayfasına yönlendiriyoruz.
}

export async function deleteBooking(bookingId) {
  // Rezervasyon silme fonksiyonu.
  const session = await auth(); // Oturum bilgisini alıyoruz.
  if (!session) throw new Error("You must be logged in"); // Eğer oturum yoksa hata fırlatıyoruz.

  // Kullanıcının rezervasyonlarını alıyoruz.
  const guestBookings = await getBookings(session.user.guestId);
  const guestBookingIds = guestBookings.map((booking) => booking.id); // Tüm rezervasyonların ID'lerini bir listeye alıyoruz.

  // Eğer silinmek istenen rezervasyon kullanıcıya ait değilse hata fırlatıyoruz.
  if (!guestBookingIds.includes(bookingId))
    throw new Error("You are not allowed to delete this booking");

  // Supabase ile "bookings" tablosundan rezervasyonu siliyoruz.
  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", bookingId);

  if (error) throw new Error("Booking could not be deleted"); // Eğer hata varsa hata fırlatıyoruz.

  revalidatePath("/account/reservations"); // sayfanın eski verileri göstermemesi ve yeni güncel verileri göstermesi için bu fonksiyon çağrılıyor.
}

export async function updateBooking(formData) {
  // Rezervasyon güncelleme fonksiyonu.
  const bookingId = Number(formData.get("bookingId")); // Formdan alınan rezervasyon ID'sini alıyoruz.

  // 1) Authentication
  const session = await auth(); // Oturum bilgisini alıyoruz.
  if (!session) throw new Error("You must be logged in"); // Eğer oturum yoksa hata fırlatıyoruz.

  // 2) Authorization
  const guestBookings = await getBookings(session.user.guestId); // Kullanıcının rezervasyonlarını alıyoruz.
  const guestBookingIds = guestBookings.map((booking) => booking.id);

  // Eğer güncellenmek istenen rezervasyon kullanıcıya ait değilse hata fırlatıyoruz.
  if (!guestBookingIds.includes(bookingId))
    throw new Error("You are not allowed to update this booking");

  // 3) Güncellenmiş verileri hazırlıyoruz.
  const updateData = {
    numGuests: Number(formData.get("numGuests")), // Misafir sayısını güncelliyoruz.
    observations: formData.get("observations").slice(0, 1000), // Gözlemleri güncelliyoruz.
  };

  // 4) Supabase ile rezervasyonu güncelliyoruz.
  const { error } = await supabase
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId)
    .select()
    .single();

  // 5) Hata kontrolü
  if (error) throw new Error("Booking could not be updated"); // Hata varsa hata fırlatıyoruz.

  // 6) Revalidation
  revalidatePath(`/account/reservations/edit/${bookingId}`); // sayfanın eski verileri göstermemesi ve yeni güncel verileri göstermesi için bu fonksiyon çağrılıyor.
  revalidatePath("/account/reservations"); // sayfanın eski verileri göstermemesi ve yeni güncel verileri göstermesi için bu fonksiyon çağrılıyor.

  // 7) Yönlendirme
  redirect("/account/reservations"); // Rezervasyonlar sayfasına yönlendiriyoruz.
}

export async function signInAction() {
  // Google ile oturum açma fonksiyonu.
  await signIn("google", { redirectTo: "/account" }); // Google ile giriş yaptıktan sonra hesabım sayfasına yönlendiriyoruz.
}

export async function signOutAction() {
  // Oturum kapatma fonksiyonu.
  await signOut({ redirectTo: "/" }); // Oturum kapatıldıktan sonra anasayfaya yönlendiriyoruz.
}
